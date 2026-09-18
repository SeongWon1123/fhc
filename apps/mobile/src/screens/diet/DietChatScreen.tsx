import React, { useEffect, useState } from 'react';
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
import { ChatBubble } from '../../components/ChatBubble';
import { Loading } from '../../components/common/Loading';
import { api } from '../../lib/api';
import { ChatMessage } from '../../types';

export const DietChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(`diet_${Date.now()}`);

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
      id: `${Date.now()}_assistant`,
      role: 'assistant',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}_user`,
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
      appendAssistantMessage('현재 식단 서비스를 사용할 수 없습니다. 연결이 복구된 뒤 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '식사 사진 분석을 위해 사진 보관함 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const userMessage: ChatMessage = {
      id: `${Date.now()}_image`,
      role: 'user',
      content: '식사 사진을 업로드했습니다.',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'meal.jpg',
      } as any);
      formData.append('session_id', sessionId);

      const { data } = await api.post('/diet/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      appendAssistantMessage(data?.analysis ?? '식단 서비스가 이미지 분석 결과를 반환하지 않았습니다. 다시 시도해주세요.');
    } catch (error) {
      console.error('이미지 분석에 실패했습니다:', error);
      appendAssistantMessage('현재 이미지 분석을 사용할 수 없습니다. 연결이 복구된 뒤 다시 시도해주세요.');
    } finally {
      setSending(false);
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
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          sending ? (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.typingText}>분석 중...</Text>
            </View>
          ) : null
        }
      />

      <View style={styles.inputContainer}>
        {Platform.OS === 'web' ? null : (
          <TouchableOpacity style={styles.cameraButton} onPress={handleImageUpload}>
            <Camera size={20} color="#6b7280" />
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.textInput}
          placeholder="식사를 기록하거나 식단 질문을 입력하세요"
          value={inputText}
          onChangeText={setInputText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.disabledButton]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || sending}
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
});
