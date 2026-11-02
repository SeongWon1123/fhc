import { Search, UserCheck } from 'lucide-react';
import { useState } from 'react';
import CoachTable from '../components/CoachTable';
import type { Coach } from '../data';
import { AdminApiError, decideCoachApplication, type CoachDecision } from '../lib/adminApi';
import { useOperationsData } from '../lib/operationsContext';

const decisionErrors: Record<number, string> = {
  403: '코치 승인은 전체 관리자만 할 수 있습니다.',
  404: '신청을 찾을 수 없습니다. 이미 처리됐는지 새로고침해 확인해주세요.',
  409: '이 계정은 현재 상태에서 처리할 수 없습니다.',
};

export default function Coaches() {
  const data = useOperationsData();
  const [coaches, setCoaches] = useState(data.coaches);
  const [applications, setApplications] = useState(data.coachApplications);
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const canDecide = data.operatorRole === 'admin';

  const query = searchTerm.toLowerCase();
  const matches = (coach: Coach) =>
    `${coach.name} ${coach.specialty} ${coach.location}`.toLowerCase().includes(query);
  const filteredCoaches = coaches.filter(matches);
  const filteredApplications = applications.filter(matches);

  const decide = async (coach: Coach, decision: CoachDecision) => {
    if (busyId) return;
    setBusyId(coach.id);
    setMessage(null);
    try {
      await decideCoachApplication(coach.id, decision, data.token);
      setApplications((current) => current.filter((item) => item.id !== coach.id));
      if (decision === 'approve') {
        setCoaches((current) => [
          { ...coach, is_verified: true },
          ...current.filter((item) => item.id !== coach.id),
        ]);
      }
      setMessage({ kind: 'success', text: `${coach.name} ${decision === 'approve' ? '승인을' : '반려를'} 저장했습니다.` });
    } catch (error) {
      const status = error instanceof AdminApiError ? error.status : 0;
      setMessage({ kind: 'error', text: decisionErrors[status] ?? '처리하지 못했습니다. 연결을 확인하고 다시 시도해주세요.' });
    } finally {
      setBusyId(null);
    }
  };

  const findCoach = (list: Coach[], id: string) => list.find((coach) => coach.id === id);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">코치 관리</h1>
          <p className="page-description">코치 신청을 승인하고 등록된 코치의 상태와 예약 성과를 검토합니다.</p>
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

      {message && (
        <div className={`badge ${message.kind === 'success' ? 'success' : 'warning'}`} role={message.kind === 'error' ? 'alert' : 'status'} style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}

      <h2 className="page-title" style={{ fontSize: 18, margin: '8px 0 12px' }}>코치 신청 {applications.length}건</h2>
      {!canDecide && <p className="page-description">코치 신청은 전체 관리자 계정에서 처리합니다.</p>}
      <CoachTable
        coaches={filteredApplications}
        busyId={busyId}
        emptyText="대기 중인 코치 신청이 없습니다."
        onVerify={canDecide ? (id, approve) => {
          const coach = findCoach(applications, id);
          if (coach) void decide(coach, approve ? 'approve' : 'reject');
        } : undefined}
      />

      <h2 className="page-title" style={{ fontSize: 18, margin: '24px 0 12px' }}>등록된 코치</h2>
      <CoachTable
        coaches={filteredCoaches}
        busyId={busyId}
        allowReject={false}
        onVerify={canDecide ? (id) => {
          const coach = findCoach(coaches, id);
          if (coach) void decide(coach, 'approve');
        } : undefined}
      />
    </div>
  );
}
