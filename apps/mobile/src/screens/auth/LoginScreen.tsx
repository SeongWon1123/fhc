import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { fetchProfile } = useStore();
  const normalizedEmail = email.trim().toLowerCase();

  const getAuthErrorMessage = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const normalized = message.toLowerCase();
    if (normalized.includes('email rate limit') || normalized.includes('rate limit')) {
      return '가입 인증 메일 발송 제한에 도달했습니다. 잠시 후 다시 시도해주세요.';
    }
    if (normalized.includes('email not confirmed')) {
      return '이메일 인증이 완료되지 않았습니다. 메일함을 확인한 뒤 다시 로그인해주세요.';
    }
    if (normalized.includes('invalid login credentials')) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (normalized.includes('already registered') || normalized.includes('already been registered')) {
      return '이미 가입된 이메일입니다. 로그인해주세요.';
    }
    return message || fallback;
  };

  const validateForm = () => {
    if (!normalizedEmail || !password) {
      Alert.alert('입력 정보 부족', '이메일과 비밀번호를 입력해주세요.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
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
    if (!validateForm()) return;

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
    } catch (error: any) {
      Alert.alert('로그인 실패', getAuthErrorMessage(error, '로그인할 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (!data.user) {
        throw new Error('계정 생성 결과를 확인할 수 없습니다.');
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

      if (data.session) {
        Alert.alert('계정 생성 완료', '계정이 생성되었습니다. 간단한 온보딩을 완료해주세요.');
      } else {
        Alert.alert('이메일 인증 필요', '계정을 활성화하려면 이메일 인증을 완료한 뒤 로그인해주세요.');
      }
    } catch (error: unknown) {
      Alert.alert('회원가입 실패', getAuthErrorMessage(error, '계정을 만들 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>FitConnect</Text>
          <Text style={styles.tagline}>코치 예약, 식단 관리, 운동 의류 추천을 한 앱에서 관리하세요.</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="이메일"
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호 입력"
            secureTextEntry
          />

          <Button title="로그인" onPress={handleLogin} loading={loading} fullWidth style={styles.button} />
          <Button
            title="계정 만들기"
            onPress={handleSignUp}
            variant="outline"
            loading={loading}
            fullWidth
            style={styles.button}
          />
        </View>

        <Text style={styles.authNote}>MVP 심사 흐름을 명확하게 확인할 수 있도록 이메일 로그인을 사용합니다.</Text>
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
  button: {
    marginBottom: 12,
  },
  authNote: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 20,
  },
});
