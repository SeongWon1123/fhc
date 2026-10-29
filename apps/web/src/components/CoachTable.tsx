import { Award, CheckCircle, Star, XCircle } from 'lucide-react';
import type { Coach } from '../data';

const sportLabels: Record<string, string> = {
  gym: '헬스', running: '러닝', pilates: '필라테스', yoga: '요가', crossfit: '크로스핏',
};

const specialtyText = (specialty: string) =>
  specialty.split(',').map((key) => key.trim()).filter(Boolean).map((key) => sportLabels[key] ?? key).join(', ');

interface CoachTableProps {
  coaches: Coach[];
  onVerify?: (coachId: string, isVerified: boolean) => void;
  busyId?: string | null;
  allowReject?: boolean;
  emptyText?: string;
}

export default function CoachTable({
  coaches, onVerify, busyId = null, allowReject = true, emptyText = '코치 프로필이 없습니다.',
}: CoachTableProps) {
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
              <td>{specialtyText(coach.specialty)}</td>
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
                {!coach.is_verified && onVerify ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => onVerify(coach.id, true)} className="text-button primary" type="button"
                      disabled={busyId !== null} aria-label={`${coach.name} 승인`}
                    >
                      {busyId === coach.id ? '처리 중' : '승인'}
                    </button>
                    {allowReject && (
                      <button
                        onClick={() => onVerify(coach.id, false)} className="text-button" type="button"
                        disabled={busyId !== null} aria-label={`${coach.name} 반려`}
                      >
                        반려
                      </button>
                    )}
                  </div>
                ) : !coach.is_verified ? (
                  <span style={{ color: 'var(--text-muted)' }}>관리자 승인 필요</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>처리 없음</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {coaches.length === 0 && <div className="empty">{emptyText}</div>}
    </div>
  );
}
