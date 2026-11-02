import React from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

const wrapping: TextStyle & {
  readonly wordBreak?: 'keep-all';
  readonly overflowWrap?: 'break-word';
} = Platform.OS === 'web' ? { wordBreak: 'keep-all', overflowWrap: 'break-word' } : {};

export function KoreanText({ style, ...props }: TextProps) {
  return <Text {...props} lineBreakStrategyIOS="hangul-word" style={[wrapping, style]} />;
}
