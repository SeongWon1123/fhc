import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { fetchProfile } = useStore();

  const validateForm = () => {
    if (!email.trim() || !password) {
      Alert.alert('입력 정보 부족', '이메일과 비밀번호를 입력해주세요.');
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        await fetchProfile(data.user.id, data.user.email ?? email.trim());
      }
    } catch (error: any) {
      Alert.alert('로그인 실패', error.message ?? '로그인할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            email: data.user.email ?? email.trim(),
            role: 'user',
            onboarding_completed: false,
          },
          { onConflict: 'id' }
        );
        await fetchProfile(data.user.id, data.user.email ?? email.trim());
      }

      Alert.alert('계정 생성 완료', '이메일 인증이 필요한 경우 메일함을 확인해주세요.', [
        { text: '메일 열기', onPress: () => Linking.openURL(`mailto:${email.trim()}`) },
        { text: '확인' },
      ]);
    } catch (error: any) {
      Alert.alert('회원가입 실패', error.message ?? '계정을 만들 수 없습니다.');
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
