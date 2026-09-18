import { Alert, Platform } from 'react-native';
import {
  confirmButtonIndex,
  isCancelButton,
  resolveButtonHandler,
  type NotifyButton,
} from './notifyCore';

export type { NotifyButton };

const composeMessage = (title: string, message?: string): string =>
  message ? `${title}\n\n${message}` : title;

/**
 * Drop-in replacement for `Alert.alert` that actually surfaces in the browser.
 *
 * Native (ios/android) delegates to `Alert.alert` with the same signature, so
 * native behaviour is unchanged. On web react-native-web's `Alert` is a no-op
 * stub, so the dialog is rendered with `window.confirm` — or `window.alert` when
 * there is nothing to choose — and the selected button's `onPress` is then
 * invoked, because screen navigation lives inside those callbacks.
 */
export const notify = (title: string, message?: string, buttons?: NotifyButton[]): void => {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = composeMessage(title, message);
  const confirmIndex = confirmButtonIndex(buttons);

  if (confirmIndex < 0) {
    window.alert(text);
    return;
  }

  if (buttons?.some((button) => isCancelButton(button))) {
    if (!window.confirm(text)) return;
  } else {
    window.alert(text);
  }

  resolveButtonHandler(buttons, confirmIndex)?.();
};
