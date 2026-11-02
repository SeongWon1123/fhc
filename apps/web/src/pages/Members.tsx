import { Calendar, Search, Target, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOperationsData } from '../lib/operationsContext';

export default function Members() {
  const [searchTerm, setSearchTerm] = useState('');
  const { members } = useOperationsData();

  const filteredMembers = useMemo(
    () =>
      members.filter((member) =>
        `${member.name} ${member.email} ${member.fitness_goal}`.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [members, searchTerm],
  );

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">회원 관리</h1>
          <p className="page-description">코칭과 식단 개인화를 위해 회원 가입 현황과 목표를 확인합니다.</p>
        </div>
        <span className="badge success">
          <Users size={14} />
          회원 {members.length}명
        </span>
      </header>

      <div className="toolbar">
        <div style={{ position: 'relative', width: 'min(420px, 100%)' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
          <input
            className="input-field"
            type="text"
            placeholder="회원 검색"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ width: '100%', paddingLeft: 40 }}
          />
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {['회원', '목표', '가입일', '상태'].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => (
              <tr key={member.id}>
                <td>
                  <strong>{member.name}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{member.email}</div>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <Target size={14} color="var(--primary)" />
                    {member.fitness_goal}
                  </span>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <Calendar size={14} color="var(--text-muted)" />
                    {member.join_date}
                  </span>
                </td>
                <td>
                  <span className="badge success">활성</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMembers.length === 0 && <div className="empty">회원 데이터가 없습니다.</div>}
      </div>
    </div>
  );
}
