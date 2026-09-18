import { type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Analytics from './pages/Analytics';
import Bookings from './pages/Bookings';
import Coaches from './pages/Coaches';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import { useSession } from './lib/useSession';
import { decideGate } from './lib/gate';
import Account from './components/Account';

/** Renders the operator console only for an authenticated session. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, unconfigured } = useSession();

  const decision = decideGate({
    loading,
    unconfigured,
    hasSession: Boolean(session),
  });

  if (decision === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p className="page-description">세션을 확인하는 중입니다...</p>
      </div>
    );
  }

  if (decision === 'unconfigured') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card" style={{ width: 'min(520px, 100%)', padding: 24 }}>
          <h1 className="page-title">인증이 설정되지 않았습니다</h1>
          <p className="page-description">
            VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경 변수를 설정해야 운영자 콘솔에 로그인할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  if (decision === 'unauthenticated') {
    return <Auth />;
  }

  return <>{children}</>;
}

/** Supplies the authenticated session that Account renders. */
function AccountRoute() {
  const { session } = useSession();
  if (!session) return null;
  return <Account session={session} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="*"
          element={
            <RequireAuth>
              <div className="app-shell">
                <Sidebar />
                <main className="main">
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/coaches" element={<Coaches />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/account" element={<AccountRoute />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                  </Routes>
                </main>
              </div>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
