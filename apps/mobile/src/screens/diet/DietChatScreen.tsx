import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, ListChecks, Send } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { uuid } from 'expo-modules-core';
import { isAxiosError } from 'axios';
import { ChatBubble } from '../../components/ChatBubble';
import { Loading } from '../../components/common/Loading';
import { api } from '../../lib/api';
import { parseDietImageAnalysis } from '../../lib/dietAnalysis';
import type { DietImageAnalysis } from '../../lib/dietAnalysis';
import type { ChatMessage, DietLog } from '../../types';

const mealOptions = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
] as const;

export const DietChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => uuid.v4());
  const [mealPreview, setMealPreview] = useState<DietImageAnalysis | null>(null);
  const [mealType, setMealType] = useState<DietLog['meal_type'] | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const requestInFlight = useRef(false);
  // Held after success until a new photo replaces the preview.
  const saveLocked = useRef(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '먹은 음식을 적거나 식사 사진을 올려주세요. 균형, 칼로리, 다음 개선점을 함께 확인해드릴게요.',
        created_at: new Date().toISOString(),
      },
    ]);
    setLoading(false);
  }, []);

  const appendAssistantMessage = (content: string) => {
    const assistantMessage: ChatMessage = {
      id: uuid.v4(),
      role: 'assistant',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || requestInFlight.current || saveStatus === 'saving') return;
    requestInFlight.current = true;

    const userMessage: ChatMessage = {
      id: uuid.v4(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setSending(true);

    try {
      const { data } = await api.post('/diet/chat', {
        session_id: sessionId,
        message: trimmed,
      });

      appendAssistantMessage(data?.reply ?? '식단 서비스가 답변을 반환하지 않았습니다. 다시 시도해주세요.');
    } catch (error) {
      console.error('식단 메시지 전송에 실패했습니다:', error);
      appendAssistantMessage(
        isAxiosError(error) && error.response?.status === 429
          ? '오늘 식단 코치 사용 횟수를 모두 사용했습니다. 내일 다시 이용해주세요.'
          : '현재 식단 서비스를 사용할 수 없습니다. 연결이 복구된 뒤 다시 시도해주세요.',
      );
    } finally {
      requestInFlight.current = false;
      setSending(false);
    }
  };

  const handleImageUpload = async () => {
    if (requestInFlight.current || saveStatus === 'saving') return;
    requestInFlight.current = true;
    setSending(true);

    try {
      // On web the picker must launch directly from the user's press.
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('권한 필요', '식사 사진 분석을 위해 사진 보관함 접근 권한이 필요합니다.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setMealPreview(null);
      setMealType(null);
      setSaveStatus('idle');
      saveLocked.current = false;
      setMessages((prev) => [...prev, {
        id: uuid.v4(),
        role: 'user',
        content: '식사 사진을 업로드했습니다.',
        created_at: new Date().toISOString(),
      }]);

      const formData = new FormData();
      if (Platform.OS === 'web') {
        if (!asset.file) {
          appendAssistantMessage('선택한 사진을 읽을 수 없습니다. 다른 사진으로 다시 시도해주세요.');
          return;
        }
        formData.append('image', asset.file);
      } else {
        const nativeImage = {
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: asset.fileName ?? 'meal.jpg',
        };
        // RN accepts URI descriptors; the shared DOM overload only models Blobs.
        Reflect.apply(formData.append, formData, ['image', nativeImage]);
      }
      const { data } = await api.post<unknown>('/diet/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const analysis = parseDietImageAnalysis(data);
      if (!analysis) {
        appendAssistantMessage('음식과 영양 정보를 확인하지 못해 저장할 수 없습니다. 선명한 식사 사진으로 다시 시도해주세요.');
        return;
      }
      setMealPreview(analysis);
      appendAssistantMessage(analysis.analysis);
    } catch (error) {
      console.error('이미지 분석에 실패했습니다:', error);
      appendAssistantMessage(
        isAxiosError(error) && error.response?.status === 429
          ? '오늘 사진 분석 사용 횟수를 모두 사용했습니다. 내일 다시 이용해주세요.'
          : '현재 이미지 분석을 사용할 수 없습니다. 연결이 복구된 뒤 다시 시도해주세요.',
      );
    } finally {
      requestInFlight.current = false;
      setSending(false);
    }
  };

  const handleSaveMeal = async () => {
    if (!mealPreview || !mealType || saveLocked.current || requestInFlight.current) return;
    saveLocked.current = true;
    requestInFlight.current = true;
    setSaveStatus('saving');
    try {
      await api.post('/diet/logs', {
        meal_type: mealType,
        food_name: mealPreview.food_name,
        calories: mealPreview.calories,
        macronutrients: mealPreview.macronutrients,
        ai_analysis: mealPreview.ai_analysis,
      });
      setSaveStatus('saved');
    } catch (error) {
      console.error('식단 기록 저장에 실패했습니다:', error);
      saveLocked.current = false;
      setSaveStatus('error');
    } finally {
      requestInFlight.current = false;
    }
  };

  if (loading) {
    return <Loading message="식단 코치를 시작하는 중..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI 식단 코치</Text>
          <Text style={styles.subtitle}>식사 기록, 영양 가이드, 사진 분석을 제공합니다.</Text>
        </View>
        <TouchableOpacity style={styles.logButton} onPress={() => navigation.navigate('DietLog')}>
          <ListChecks size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          <>
          {sending ? (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.typingText}>분석 중...</Text>
            </View>
          ) : null}
          {mealPreview ? (
            <View style={styles.mealPreview}>
              <Text style={styles.previewTitle}>식사 기록 미리보기</Text>
              <Text style={styles.foodName}>{mealPreview.food_name} · {mealPreview.calories} kcal</Text>
              <Text style={styles.previewText}>
                탄수화물 {mealPreview.macronutrients.carb}g · 단백질 {mealPreview.macronutrients.protein}g
                {'\n'}지방 {mealPreview.macronutrients.fat}g · 식이섬유 {mealPreview.macronutrients.fiber}g
              </Text>
              <Text style={styles.previewText}>{mealPreview.ai_analysis}</Text>
              {mealPreview.recommendations.map((recommendation, index) => (
                <Text key={index} style={styles.previewText}>• {recommendation}</Text>
              ))}
              <Text style={styles.previewText}>식사 종류를 선택해주세요</Text>
              <View style={styles.mealOptions}>
                {mealOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: mealType === option.value, disabled: saveStatus === 'saving' || saveStatus === 'saved' }}
                    style={[styles.mealOption, mealType === option.value && styles.selectedMealOption]}
                    onPress={() => setMealType(option.value)}
                    disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  >
                    <Text style={styles.previewText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.saveButton, (!mealType || sending || saveStatus === 'saving' || saveStatus === 'saved') && styles.disabledButton]}
                onPress={handleSaveMeal}
                disabled={!mealType || sending || saveStatus === 'saving' || saveStatus === 'saved'}
              >
                <Text style={styles.saveButtonText}>
                  {saveStatus === 'saving' ? '저장 중...' : saveStatus === 'saved' ? '저장 완료' : '식단 기록에 저장'}
                </Text>
              </TouchableOpacity>
              {saveStatus === 'saved' ? (
                <Text accessibilityLiveRegion="polite" style={styles.previewText}>식단 기록에 저장했습니다. 상단 기록 버튼에서 확인하세요.</Text>
              ) : null}
              {saveStatus === 'error' ? (
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>저장하지 못했습니다. 연결을 확인하고 다시 시도해주세요.</Text>
              ) : null}
            </View>
          ) : null}
          </>
        }
      />

      <View style={styles.inputContainer}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="식사 사진 분석"
            style={[styles.cameraButton, (sending || saveStatus === 'saving') && styles.disabledButton]}
            onPress={handleImageUpload}
            disabled={sending || saveStatus === 'saving'}
          >
            <Camera size={20} color="#6b7280" />
          </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder="식사를 기록하거나 식단 질문을 입력하세요"
          value={inputText}
          onChangeText={setInputText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending || saveStatus === 'saving') && styles.disabledButton]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || sending || saveStatus === 'saving'}
        >
          <Send size={20} color={inputText.trim() && !sending ? '#2563eb' : '#d1d5db'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  logButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 92,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  typingText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
  },
  cameraButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 105,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    fontSize: 15,
    marginRight: 8,
    marginBottom: 8,
    color: '#111827',
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  mealPreview: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef2f7',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  mealOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealOption: {
    minHeight: 44,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  selectedMealOption: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  saveButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    lineHeight: 20,
  },
});
