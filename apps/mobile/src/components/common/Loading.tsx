import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet
} from 'react-native';

interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'large',
  color = '#3b82f6',
  message,
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});