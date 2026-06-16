import { Award, CheckCircle, Star, XCircle } from 'lucide-react';
import type { Coach } from '../data';

interface CoachTableProps {
  coaches: Coach[];
  onVerify?: (coachId: string, isVerified: boolean) => void;
}

export default function CoachTable({ coaches, onVerify }: CoachTableProps) {
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            {['코치', '전문 분야', '지역', '평점', '예약 수', '기준가', '상태', '처리'].map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {coaches.map((coach) => (
            <tr key={coach.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge success" aria-hidden="true">
                    <Award size={16} />
                  </span>
                  <strong>{coach.name}</strong>
                </div>
              </td>
              <td>{coach.specialty}</td>
              <td>{coach.location}</td>
              <td>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <Star size={14} fill="var(--warning)" color="var(--warning)" />
                  {coach.rating.toFixed(1)}
                </span>
              </td>
              <td>{coach.booking_count}</td>
              <td>{new Intl.NumberFormat('ko-KR').format(coach.base_price)}원</td>
              <td>
                <span className={`badge ${coach.is_verified ? 'success' : 'warning'}`}>
                  {coach.is_verified ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {coach.is_verified ? '승인됨' : '검토 대기'}
                </span>
              </td>
              <td>
                {!coach.is_verified ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onVerify?.(coach.id, true)} className="text-button primary" type="button">
                      승인
                    </button>
                    <button onClick={() => onVerify?.(coach.id, false)} className="text-button" type="button">
                      반려
                    </button>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>처리 없음</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {coaches.length === 0 && <div className="empty">코치 프로필이 없습니다.</div>}
    </div>
  );
}
