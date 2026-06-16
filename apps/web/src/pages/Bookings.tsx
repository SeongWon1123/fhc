import { ClipboardCheck, Filter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BookingTable from '../components/BookingTable';
import type { Booking, BookingStatus } from '../data';
import { loadBookings } from '../lib/operationsData';

const statusFilters: Array<BookingStatus | 'all'> = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];
const filterLabel: Record<BookingStatus | 'all', string> = {
  all: '전체',
  pending: '대기',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  no_show: '노쇼',
};

export default function Bookings() {
  const [activeFilter, setActiveFilter] = useState<BookingStatus | 'all'>('all');
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    loadBookings().then(setBookings);
  }, []);

  const filteredBookings = useMemo(
    () => (activeFilter === 'all' ? bookings : bookings.filter((booking) => booking.status === activeFilter)),
    [activeFilter, bookings],
  );

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">예약 관리</h1>
          <p className="page-description">PT 예약의 대기, 확정, 완료, 취소 상태를 한 화면에서 추적합니다.</p>
        </div>
        <span className="badge success">
          <ClipboardCheck size={14} />
          총 {bookings.length}건
        </span>
      </header>

      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
          <Filter size={16} />
          <span>상태</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {statusFilters.map((filter) => (
            <button
              key={filter}
              className={`text-button ${activeFilter === filter ? 'primary' : ''}`}
              onClick={() => setActiveFilter(filter)}
              type="button"
            >
              {filterLabel[filter]}
            </button>
          ))}
        </div>
      </div>

      <BookingTable bookings={filteredBookings} />
    </div>
  );
}
