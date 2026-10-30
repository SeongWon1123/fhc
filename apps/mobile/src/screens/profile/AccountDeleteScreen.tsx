import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { isAxiosError } from 'axios';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { KoreanText } from '../../components/common/KoreanText';
import { api } from '../../lib/api';
import { notify } from '../../lib/notify';
import { useStore } from '../../lib/store';
import { tokens } from '../../theme/tokens';

export const AccountDeleteScreen: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const submitting = useRef(false);
  const confirmed = confirmation === '계정 삭제' && password.length > 0;

  const handleDelete = async () => {
    if (!confirmed || submitting.current) return;
    submitting.current = true;
    setIsDeleting(true);
    try {
      await api.delete('/account', { data: { password } });
      await useStore.getState().signOut();
      notify('계정이 삭제되었습니다.');
    } catch (error: unknown) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status === 403) setPassword('');
      const message = status === 403
        ? '비밀번호가 올바르지 않습니다.'
        : status === 409
          ? '예정된 예약을 먼저 취소해 주세요.'
          : '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      notify('계정 삭제 실패', message);
    } finally {
      submitting.current = false;
      setIsDeleting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <KoreanText accessibilityRole="header" style={styles.title}>계정 삭제</KoreanText>
        <KoreanText style={styles.description}>
          탈퇴하면 계정과 연결된 모든 데이터가 영구 삭제됩니다.
        </KoreanText>

        <View style={styles.notice}>
          <KoreanText style={styles.sectionTitle}>삭제되는 정보</KoreanText>
          <KoreanText style={styles.body}>프로필, 운동·식단 기록, 예약·리뷰, 알림</KoreanText>
          <KoreanText style={styles.warning}>
            삭제한 계정과 데이터는 복구할 수 없습니다. 이 작업은 되돌릴 수 없습니다.
          </KoreanText>
        </View>

        <KoreanText style={styles.body}>
          예정된 예약이 있다면 먼저 취소해 주세요. 코치는 받은 예약도 모두 취소해야 합니다.
        </KoreanText>
        <KoreanText style={styles.confirmation}>
          계속하려면 아래에 '계정 삭제'를 정확히 입력해 주세요.
        </KoreanText>
        <Input
          label="현재 비밀번호"
          accessibilityLabel="현재 비밀번호"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isDeleting}
        />
        <Input
          label="삭제 확인 입력"
          accessibilityLabel="삭제 확인 입력"
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isDeleting}
        />
        <Button
          title="계정 영구 삭제"
          onPress={handleDelete}
          disabled={!confirmed || isDeleting}
          loading={isDeleting}
          fullWidth
          style={confirmed && !isDeleting ? styles.deleteButton : undefined}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.background },
  content: { padding: tokens.space.xxl, paddingBottom: tokens.space.section },
  title: {
    fontSize: tokens.font.title, fontWeight: '800', color: tokens.color.text,
    marginBottom: tokens.space.md,
  },
  description: {
    fontSize: tokens.font.body, lineHeight: 26, color: tokens.color.mutedText,
    marginBottom: tokens.space.xxl,
  },
  notice: {
    backgroundColor: tokens.color.surface, borderRadius: tokens.radius.card,
    borderWidth: 1, borderColor: tokens.color.border, padding: tokens.space.xl,
    marginBottom: tokens.space.xxl,
  },
  sectionTitle: {
    fontSize: tokens.font.section, fontWeight: '800', color: tokens.color.text,
    marginBottom: tokens.space.md,
  },
  body: { fontSize: tokens.font.body, lineHeight: 26, color: tokens.color.text },
  warning: {
    fontSize: tokens.font.body, lineHeight: 26, color: tokens.color.danger,
    marginTop: tokens.space.lg, fontWeight: '600',
  },
  confirmation: {
    fontSize: tokens.font.secondary, lineHeight: 24, color: tokens.color.mutedText,
    marginTop: tokens.space.xxl, marginBottom: tokens.space.xxl,
  },
  deleteButton: { backgroundColor: tokens.color.danger },
});
