import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChatMessage } from '../types';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.avatarContainer}>
          <Text style={styles.avatar}>AI</Text>
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>
        <Text style={[styles.time, isUser ? styles.userTime : styles.assistantTime]}>
          {new Date(message.created_at).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 14,
    maxWidth: '82%',
  },
  userContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  avatar: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  bubble: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    minWidth: 100,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#ffffff',
  },
  assistantText: {
    color: '#111827',
  },
  time: {
    fontSize: 10,
    marginTop: 6,
  },
  userTime: {
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'right',
  },
  assistantTime: {
    color: '#9ca3af',
    textAlign: 'left',
  },
});
