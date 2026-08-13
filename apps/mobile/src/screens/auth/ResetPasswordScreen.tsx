import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

export const ResetPasswordScreen: React.FC = () => {
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const { signOut } = useStore();

  const validate = () => {
    if (password.length < 8) {
      Alert.alert('비밀번호 확인', '새 비밀번호는 8자 이상으로 입력해주세요.');
      return false;
    }
    if (password !== passwordConfirmation) {
      Alert.alert('비밀번호 확인', '새 비밀번호가 일치하지 않습니다.');
      return false;
    }
    return true;
  };

  const handleUpdatePassword = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('비밀번호 변경 완료', '새 비밀번호로 다시 로그인해주세요.', [
        { text: '로그인으로', onPress: () => void signOut() },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '비밀번호를 변경할 수 없습니다.';
      Alert.alert('비밀번호 변경 실패', message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await signOut();
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>계정 보안</Text>
        <Text style={styles.title}>새 비밀번호 설정</Text>
        <Text style={styles.description}>
          이메일 확인이 완료되었습니다. 다른 서비스에서 사용하지 않은 새 비밀번호를 설정해주세요.
        </Text>
        <Input
          label="새 비밀번호"
          value={password}
          onChangeText={setPassword}
          placeholder="8자 이상 입력"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="새 비밀번호 확인"
          value={passwordConfirmation}
          onChangeText={setPasswordConfirmation}
          placeholder="새 비밀번호를 다시 입력"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button title="비밀번호 변경" onPress={handleUpdatePassword} loading={loading} fullWidth style={styles.primaryButton} />
        <Button title="취소" onPress={handleCancel} disabled={loading} variant="outline" fullWidth />
      </View>
    </View>
  );
};

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f172a',
  },
  card: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#ffffff',
  },
  eyebrow: {
    marginBottom: 8,
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    marginBottom: 10,
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    marginBottom: 24,
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    marginBottom: 12,
  },
});
