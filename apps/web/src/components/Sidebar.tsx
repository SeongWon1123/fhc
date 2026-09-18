import { Activity, BarChart3, CalendarCheck, Dumbbell, LogOut, Shirt, UserRound, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const sidebarItems = [
  { path: '/dashboard', label: '운영 개요', icon: Activity },
  { path: '/coaches', label: '코치 관리', icon: Dumbbell },
  { path: '/bookings', label: '예약 관리', icon: CalendarCheck },
  { path: '/members', label: '회원 관리', icon: Users },
  { path: '/analytics', label: '지표 분석', icon: BarChart3 },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1 className="sidebar-title">FitConnect</h1>
        <p className="sidebar-subtitle">푸드·헬스·의류 운영 관리</p>
      </div>

      <nav className="sidebar-nav" aria-label="주요 화면 이동">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={`nav-button ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Shirt size={16} aria-hidden="true" />
          <span>API 연동 MVP 운영</span>
        </div>
        <button
          className="nav-button"
          onClick={() => navigate('/account')}
          type="button"
          style={{ marginTop: 12 }}
        >
          <UserRound size={18} aria-hidden="true" />
          내 계정
        </button>
        <button
          className="nav-button"
          onClick={() => supabase?.auth.signOut()}
          type="button"
          style={{ marginTop: 4 }}
        >
          <LogOut size={18} aria-hidden="true" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
