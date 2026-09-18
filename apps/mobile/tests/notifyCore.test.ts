import {
  cancelButtonIndex,
  confirmButtonIndex,
  isCancelButton,
  resolveButtonHandler,
  type NotifyButton,
} from '../src/lib/notifyCore';

/**
 * Bun injects `test`/`expect` as Jest-compatible globals into test files, so no
 * runtime import is needed. They are declared locally on purpose: this repo has
 * no bun-types dependency while `tsc --noEmit` still type-checks this file.
 */
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: unknown) => {
  toBe(expected: unknown): void;
};

test('resolveButtonHandler returns the handler of the pressed affirm button', () => {
  const confirm = () => {};
  const buttons: NotifyButton[] = [
    { text: '취소', style: 'cancel' },
    { text: '확인', onPress: confirm },
  ];
  expect(resolveButtonHandler(buttons, 1)).toBe(confirm);
});

test('resolveButtonHandler returns nothing when a cancel-style button is pressed', () => {
  const confirm = () => {};
  const buttons: NotifyButton[] = [
    { text: '취소', style: 'cancel' },
    { text: '확인', onPress: confirm },
  ];
  expect(resolveButtonHandler(buttons, 0)).toBe(undefined);
});

test('cancel is recognised from the button text as well as from the style', () => {
  const confirm = () => {};
  const buttons: NotifyButton[] = [{ text: '취소' }, { text: '확인', onPress: confirm }];
  expect(resolveButtonHandler(buttons, 0)).toBe(undefined);
  expect(confirmButtonIndex(buttons)).toBe(1);
});

test('the LAST non-cancel button is the confirm-style one', () => {
  const buttons: NotifyButton[] = [
    { text: '취소', style: 'cancel' },
    { text: '확인', onPress: () => {} },
    { text: '로그아웃', onPress: () => {}, style: 'destructive' },
  ];
  expect(confirmButtonIndex(buttons)).toBe(2);
  expect(cancelButtonIndex(buttons)).toBe(0);
});

test('an empty or absent button list has nothing to confirm and nothing to run', () => {
  expect(confirmButtonIndex(undefined)).toBe(-1);
  expect(confirmButtonIndex([])).toBe(-1);
  expect(resolveButtonHandler(undefined, 0)).toBe(undefined);
  expect(resolveButtonHandler([], 0)).toBe(undefined);
});

test('an out-of-range press and a button without a handler resolve to nothing', () => {
  const buttons: NotifyButton[] = [{ text: '확인', onPress: () => {} }];
  expect(resolveButtonHandler(buttons, 5)).toBe(undefined);
  expect(resolveButtonHandler([{ text: '예약 보기' }], 0)).toBe(undefined);
});

test('a single non-cancel button is the confirm-style button', () => {
  const viewBookings = () => {};
  const buttons: NotifyButton[] = [{ text: '예약 보기', onPress: viewBookings }];
  expect(confirmButtonIndex(buttons)).toBe(0);
  expect(resolveButtonHandler(buttons, 0)).toBe(viewBookings);
});

test('a cancel-only list has nothing to confirm', () => {
  expect(confirmButtonIndex([{ text: '취소', style: 'cancel' }])).toBe(-1);
  expect(isCancelButton({ text: '취소' })).toBe(true);
  expect(isCancelButton({ text: '확인' })).toBe(false);
});
