import { createContext, useContext } from 'react';
import type { OperatorAccess } from './adminApi';
import type { OperationsData } from './operationsData';

export type OperationsSession = OperationsData & {
  readonly token: string;
  readonly operatorRole: OperatorAccess['role'];
};

export const OperationsContext = createContext<OperationsSession | null>(null);

export function useOperationsData(): OperationsSession {
  const data = useContext(OperationsContext);
  if (!data) throw new Error('운영 데이터가 준비되지 않았습니다.');
  return data;
}
