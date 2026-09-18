/**
 * Pure button-selection rule shared by the native and web notification paths.
 *
 * This module must stay free of `react-native` (and `react`) imports: bun cannot
 * parse react-native's Flow source, so keeping the rule pure is what makes it
 * unit-testable here. `src/lib/notify.ts` owns the platform wiring.
 */

export type NotifyButtonStyle = 'default' | 'cancel' | 'destructive';

export type NotifyButton = {
  text?: string;
  onPress?: () => void;
  style?: NotifyButtonStyle;
};

/** Cancel wording used by the app's own dialogs; lower-cased for lookup. */
const CANCEL_TEXTS = ['취소', 'cancel', '닫기', '아니오', '아니요'];

export const isCancelButton = (button: NotifyButton | undefined): boolean => {
  if (!button) return false;
  if (button.style === 'cancel') return true;
  const text = (button.text ?? '').trim().toLowerCase();
  return text.length > 0 && CANCEL_TEXTS.indexOf(text) >= 0;
};

/**
 * Index of the button a confirm-style dialog treats as "OK": the LAST non-cancel
 * button (the dismiss button leads, the affirmative action sits rightmost).
 * Returns -1 when the alert carries nothing to confirm.
 */
export const confirmButtonIndex = (buttons?: readonly NotifyButton[] | null): number => {
  const list = buttons ?? [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (!isCancelButton(list[index])) return index;
  }
  return -1;
};

/**
 * The handler that must run for `pressedIndex`, or undefined when the press was
 * a cancel/dismiss or the button carries no handler.
 */
export const resolveButtonHandler = (
  buttons: readonly NotifyButton[] | undefined | null,
  pressedIndex: number,
): (() => void) | undefined => {
  const button = (buttons ?? [])[pressedIndex];
  if (!button || isCancelButton(button)) return undefined;
  return button.onPress;
};
