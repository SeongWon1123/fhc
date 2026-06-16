import { Search, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import CoachTable from '../components/CoachTable';
import type { Coach } from '../data';
import { loadCoaches } from '../lib/operationsData';

export default function Coaches() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCoaches().then(setCoaches);
  }, []);

  const filteredCoaches = useMemo(
    () =>
      coaches.filter((coach) =>
        `${coach.name} ${coach.specialty} ${coach.location}`.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [coaches, searchTerm],
  );

  const handleVerify = (coachId: string, isVerified: boolean) => {
    setCoaches((current) =>
      current.map((coach) => (coach.id === coachId ? { ...coach, is_verified: isVerified } : coach)),
    );
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">코치 관리</h1>
          <p className="page-description">코치 공급, 전문 분야, 승인 상태, 예약 성과를 검토합니다.</p>
        </div>
        <span className="badge success">
          <UserCheck size={14} />
          승인 {coaches.filter((coach) => coach.is_verified).length}명
        </span>
      </header>

      <div className="toolbar">
        <div style={{ position: 'relative', width: 'min(420px, 100%)' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
          <input
            className="input-field"
            type="text"
            placeholder="이름, 전문 분야, 지역으로 검색"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ width: '100%', paddingLeft: 40 }}
          />
        </div>
      </div>

      <CoachTable coaches={filteredCoaches} onVerify={handleVerify} />
    </div>
  );
}
