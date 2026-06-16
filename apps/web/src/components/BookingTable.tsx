import type { Booking } from '../data';

interface BookingTableProps {
  bookings: Booking[];
}

const statusLabel: Record<Booking['status'], string> = {
  pending: '대기',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  no_show: '노쇼',
};

const sessionTypeLabel: Record<Booking['session_type'], string> = {
  online: '온라인',
  offline: '오프라인',
};

export default function BookingTable({ bookings }: BookingTableProps) {
  const truncateId = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}...` : id);
  const statusClass = (status: Booking['status']) =>
    status === 'completed' || status === 'confirmed'
      ? 'success'
      : status === 'pending'
        ? 'warning'
        : 'danger';

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            {['예약 ID', '회원', '코치', '예약 일시', '방식', '상태', '매출'].map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}>
                {truncateId(booking.id)}
              </td>
              <td>{booking.user_name}</td>
              <td>{booking.coach_name}</td>
              <td>{new Date(booking.scheduled_at).toLocaleString('ko-KR')}</td>
              <td>{sessionTypeLabel[booking.session_type]}</td>
              <td>
                <span className={`badge ${statusClass(booking.status)}`}>{statusLabel[booking.status]}</span>
              </td>
              <td>{formatAmount(booking.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {bookings.length === 0 && <div className="empty">예약 데이터가 없습니다.</div>}
    </div>
  );
}
