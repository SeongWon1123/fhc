import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  // The native tree is returned untouched below; the phone frame only exists on
  // web, where the exported app would otherwise stretch across the whole window.
  const content = (
    <>
      <RootNavigator />
      <StatusBar style="auto" />
    </>
  );

  if (Platform.OS === 'web') {
    return <View style={styles.phoneFrame}>{content}</View>;
  }

  return content;
}

const styles = StyleSheet.create({
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'stretch',
    marginHorizontal: 'auto',
    backgroundColor: '#ffffff',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e5e7eb',
    boxShadow: '0 0 24px rgba(15, 23, 42, 0.12)',
  },
});
