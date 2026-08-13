import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { getAuthRedirectUrl } from '../../lib/authLinking';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

type AuthStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  ResetPassword: undefined;
};

type LoginScreenProps = StackScreenProps<AuthStackParamList, 'Login'> & {
  authMessage?: string | null;
  onDismissAuthMessage?: () => void;
};

const RESEND_COOLDOWN_SECONDS = 60;

export const LoginScreen: React.FC<LoginScreenProps> = ({ authMessage, onDismissAuthMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { fetchProfile } = useStore();
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const getAuthErrorMessage = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const normalized = message.toLowerCase();
    if (normalized.includes('email rate limit') || normalized.includes('rate limit')) {
      return '인증 메일 발송 요청이 많습니다. 잠시 후 다시 시도해주세요.';
    }
    if (normalized.includes('email not confirmed')) {
      return '이메일 인증이 아직 완료되지 않았습니다. 메일함의 인증 링크를 열어주세요.';
    }
    if (normalized.includes('invalid login credentials')) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (normalized.includes('same password')) {
      return '기존 비밀번호와 다른 새 비밀번호를 입력해주세요.';
    }
    return message || fallback;
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validateCredentials = () => {
    if (!normalizedEmail || !password) {
      Alert.alert('입력 정보 부족', '이메일과 비밀번호를 입력해주세요.');
      return false;
    }
    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('이메일 형식 확인', '올바른 이메일 주소를 입력해주세요.');
      return false;
    }
    if (password.length < 8) {
      Alert.alert('비밀번호 확인', '비밀번호는 8자 이상으로 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateCredentials()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (data.user) {
        await fetchProfile(data.user.id, data.user.email ?? normalizedEmail);
      }
    } catch (error: unknown) {
      Alert.alert('로그인 실패', getAuthErrorMessage(error, '로그인할 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!validateCredentials()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: getAuthRedirectUrl() },
      });
      if (error) throw error;
      if (!data.user) {
        throw new Error('계정 생성 결과를 확인할 수 없습니다.');
      }

      if (!data.session) {
        setPendingVerificationEmail(normalizedEmail);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        Alert.alert('이메일 인증 필요', '메일함의 인증 링크를 열면 FitConnect 앱으로 돌아와 가입을 완료할 수 있습니다.');
        return;
      }

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          email: data.user.email ?? normalizedEmail,
          role: 'user',
          onboarding_completed: false,
        },
        { onConflict: 'id' }
      );
      if (profileError) {
        console.warn('Initial profile creation failed; onboarding will retry.', profileError.message);
      }
      await fetchProfile(data.user.id, data.user.email ?? normalizedEmail);
      Alert.alert('계정 생성 완료', '간단한 온보딩을 완료해주세요.');
    } catch (error: unknown) {
      Alert.alert('회원가입 실패', getAuthErrorMessage(error, '계정을 만들 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = pendingVerificationEmail ?? normalizedEmail;
    if (!isValidEmail(targetEmail)) {
      Alert.alert('이메일 입력', '인증 메일을 다시 보내려면 올바른 이메일 주소를 입력해주세요.');
      return;
    }
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: { emailRedirectTo: getAuthRedirectUrl() },
      });
      if (error) throw error;
      setPendingVerificationEmail(targetEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert('인증 메일 재발송', '메일함과 스팸함을 확인해주세요.');
    } catch (error: unknown) {
      Alert.alert('재발송 실패', getAuthErrorMessage(error, '인증 메일을 다시 보낼 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('이메일 입력', '비밀번호 재설정 메일을 받을 이메일 주소를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getAuthRedirectUrl(),
      });
      if (error) throw error;
      Alert.alert('비밀번호 재설정 안내', '계정이 존재하는 경우 재설정 링크를 이메일로 보냈습니다. 메일함과 스팸함을 확인해주세요.');
    } catch (error: unknown) {
      Alert.alert('재설정 요청 실패', getAuthErrorMessage(error, '비밀번호 재설정 메일을 보낼 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (value: string) => {
    if (authMessage) onDismissAuthMessage?.();
    setEmail(value);
  };

  const resendLabel = resendCooldown > 0
    ? `인증 메일 다시 보내기 (${resendCooldown}초)`
    : '인증 메일 다시 보내기';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>FitConnect</Text>
          <Text style={styles.tagline}>코치 예약, 식단 관리, 운동 의류 추천을 한 앱에서 관리하세요.</Text>
        </View>
        <View style={styles.form}>
          {authMessage ? <Text style={styles.errorBanner}>{authMessage}</Text> : null}
          {pendingVerificationEmail ? (
            <View style={styles.verificationBanner}>
              <Text style={styles.verificationTitle}>이메일 인증을 기다리고 있어요</Text>
              <Text style={styles.verificationText}>{pendingVerificationEmail} 메일함에서 FitConnect 인증 링크를 열어주세요.</Text>
              <Button title={resendLabel} onPress={handleResendConfirmation} loading={loading} disabled={resendCooldown > 0} variant="outline" fullWidth style={styles.resendButton} />
            </View>
          ) : null}
          <Input
            label="이메일"
            value={email}
            onChangeText={handleEmailChange}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Input
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            placeholder="8자 이상 입력"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={handlePasswordReset} disabled={loading} style={({ pressed }) => [styles.forgotPassword, pressed && styles.pressed]}>
            <Text style={styles.forgotPasswordText}>비밀번호를 잊으셨나요?</Text>
          </Pressable>
          <Button title="로그인" onPress={handleLogin} loading={loading} fullWidth style={styles.button} />
          <Button title="계정 만들기" onPress={handleSignUp} variant="outline" loading={loading} fullWidth style={styles.button} />
        </View>
        <Text style={styles.authNote}>이메일 인증을 완료한 뒤 FitConnect의 모든 기능을 안전하게 이용할 수 있습니다.</Text>
      </ScrollView>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  errorBanner: {
    marginBottom: 16,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  verificationBanner: {
    marginBottom: 16,
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#eff6ff',
  },
  verificationTitle: {
    marginBottom: 4,
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '700',
  },
  verificationText: {
    color: '#1e3a8a',
    fontSize: 14,
    lineHeight: 20,
  },
  resendButton: {
    marginTop: 12,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 16,
    paddingVertical: 6,
  },
  forgotPasswordText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    marginBottom: 12,
  },
  authNote: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },
});
