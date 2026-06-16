import { CalendarCheck, Dumbbell, Shirt, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import BookingTable from '../components/BookingTable';
import StatsCard from '../components/StatsCard';
import type { Booking, ClothingFeedItem, Coach, Member } from '../data';
import { loadOperationsData, type OperationsDataSource } from '../lib/operationsData';

const sourceBadge: Record<OperationsDataSource, { className: string; label: string }> = {
  supabase: { className: 'success', label: 'Supabase 실데이터' },
  'demo-fallback': { className: 'warning', label: '시연용 대체 데이터' },
  empty: { className: 'danger', label: '연결 데이터 없음' },
};

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clothingItems, setClothingItems] = useState<ClothingFeedItem[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [source, setSource] = useState<OperationsDataSource>('empty');

  useEffect(() => {
    loadOperationsData().then((data) => {
      setBookings(data.bookings);
      setClothingItems(data.clothingItems);
      setCoaches(data.coaches);
      setMembers(data.members);
      setSource(data.source);
    });
  }, []);

  const monthlyRevenue = bookings
    .filter((booking) => booking.status === 'completed' || booking.status === 'confirmed')
    .reduce((sum, booking) => sum + booking.amount, 0);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">운영 개요</h1>
          <p className="page-description">
            코치 공급, 회원 수요, 식단 코칭, 의류 추천 흐름을 하나의 배포형 MVP 대시보드에서 관리합니다.
          </p>
        </div>
        <span className={`badge ${sourceBadge[source].className}`}>{sourceBadge[source].label}</span>
      </header>

      <section className="grid stats-grid" aria-label="핵심 지표">
        <StatsCard title="회원" value={members.length} change={12} icon={Users} tone="secondary" />
        <StatsCard title="코치" value={coaches.length} change={8} icon={Dumbbell} />
        <StatsCard title="예약" value={bookings.length} change={5} icon={CalendarCheck} tone="warning" />
        <StatsCard
          title="매출"
          value={new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(monthlyRevenue)}
          change={18}
          icon={Shirt}
          tone="primary"
        />
      </section>

      <section className="grid content-grid">
        <div>
          <div className="toolbar">
            <h2 className="section-title">최근 예약</h2>
          </div>
          <BookingTable bookings={bookings} />
        </div>

        <aside className="card">
          <div className="metric-list">
            <h2 className="section-title">의류 추천 피드</h2>
            {clothingItems.map((item) => (
              <div className="metric-row" key={item.id}>
                <div>
                  <strong>{item.item}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {item.sport} / {item.category}
                  </div>
                </div>
                <span>{new Intl.NumberFormat('ko-KR').format(item.price)}원</span>
              </div>
            ))}
            {clothingItems.length === 0 && <div className="empty">의류 추천 데이터가 없습니다.</div>}
          </div>
        </aside>
      </section>
    </div>
  );
}
