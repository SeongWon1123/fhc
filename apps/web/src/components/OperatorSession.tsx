import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../supabaseClient';
import { AdminApiError, checkOperatorAccess, type OperatorAccess } from '../lib/adminApi';
import { decideGate, type AccessState } from '../lib/gate';
import { loadOperationsData, type OperationsData } from '../lib/operationsData';
import { OperationsContext } from '../lib/operationsContext';
import Auth from './Auth';

/** App keys this boundary by user and token, discarding all previous operator state. */
export default function OperatorSession({ token, children }: { token: string; children: ReactNode }) {
  const [access, setAccess] = useState<AccessState>('checking');
  const [data, setData] = useState<OperationsData | null>(null);
  const [operatorRole, setOperatorRole] = useState<OperatorAccess['role'] | null>(null);
  const [dataFailed, setDataFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let checkingAccess = true;
    async function load() {
      try {
        const granted = await checkOperatorAccess(token, controller.signal);
        if (controller.signal.aborted) return;
        setOperatorRole(granted.role);
        checkingAccess = false;
        setAccess('allowed');
        const overview = await loadOperationsData(token, controller.signal);
        if (!controller.signal.aborted) setData(overview);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof AdminApiError && error.status === 401) setAccess('unauthenticated');
        else if (error instanceof AdminApiError && error.status === 403) setAccess('denied');
        else if (checkingAccess) setAccess('failed');
        else setDataFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [token]);

  const decision = decideGate({ loading: false, unconfigured: false, hasSession: true, access });
  if (decision === 'unauthenticated') return <Auth />;
  if (decision === 'authenticated' && data && operatorRole) {
    return (
      <OperationsContext.Provider value={{ ...data, token, operatorRole }}>{children}</OperationsContext.Provider>
    );
  }

  const failed = decision === 'denied' || decision === 'failed' || dataFailed;
  const title = decision === 'denied' ? '접근 권한이 없습니다'
    : decision === 'failed' ? '운영자 권한을 확인하지 못했습니다'
    : dataFailed ? '운영 데이터를 불러오지 못했습니다' : '운영자 정보를 확인하는 중입니다...';
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ width: 'min(520px, 100%)', padding: 24 }} role={failed ? 'alert' : 'status'}>
        <h1 className="page-title">{title}</h1>
        {failed && (
          <>
            <p className="page-description">
              {decision === 'denied' ? '관리자 또는 담당 체육관 운영자 계정으로 로그인해주세요.' : '연결 상태를 확인한 뒤 다시 시도해주세요.'}
            </p>
            <button className="text-button primary" type="button" onClick={() => window.location.reload()}>다시 시도</button>
            <button className="text-button" type="button" onClick={() => void supabase?.auth.signOut()}>로그아웃</button>
          </>
        )}
      </div>
    </div>
  );
}
