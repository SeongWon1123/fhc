import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CalendarCheck, DollarSign, Shirt, Users } from 'lucide-react';
import { useMemo } from 'react';
import StatsCard from '../components/StatsCard';
import { useOperationsData } from '../lib/operationsContext';

const COLORS = ['#13795b', '#335c99', '#b86b00', '#7a4b9f'];

export default function Analytics() {
  const { bookings, clothingItems, coaches, members } = useOperationsData();

  const revenue = bookings.reduce((sum, booking) => sum + booking.amount, 0);
  const trendData = useMemo(() => {
    const byDate = new Map<string, { date: string; bookings: number; users: number }>();

    bookings.forEach((booking) => {
      const date = new Date(booking.scheduled_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
      const current = byDate.get(date) ?? { date, bookings: 0, users: 0 };
      current.bookings += 1;
      byDate.set(date, current);
    });

    members.forEach((member) => {
      const date = member.join_date || '미확인';
      const current = byDate.get(date) ?? { date, bookings: 0, users: 0 };
      current.users += 1;
      byDate.set(date, current);
    });

    return Array.from(byDate.values()).slice(-10);
  }, [bookings, members]);
  const distribution = [
    { name: '회원', value: members.length },
    { name: '코치', value: coaches.length },
    { name: '의류 상품', value: clothingItems.length },
  ];

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">지표 분석</h1>
          <p className="page-description">MVP의 푸드·헬스·의류 흐름을 사업 지표로 확인합니다.</p>
        </div>
        <span className="badge success">
          <BarChart3 size={14} />
          출시 KPI 화면
        </span>
      </header>

      <section className="grid stats-grid">
        <StatsCard title="전체 사용자" value={members.length + coaches.length} change={12} icon={Users} tone="secondary" />
        <StatsCard title="예약" value={bookings.length} change={5} icon={CalendarCheck} />
        <StatsCard
          title="총매출"
          value={new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(revenue)}
          change={18}
          icon={DollarSign}
          tone="primary"
        />
        <StatsCard title="의류 SKU" value={clothingItems.length} change={9} icon={Shirt} tone="warning" />
      </section>

      <section className="grid content-grid">
        <div className="card" style={{ padding: 20 }}>
          <h2 className="section-title">성장 추이</h2>
          <div style={{ height: 320, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf0" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="bookings" fill="#13795b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="users" fill="#335c99" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 className="section-title">서비스 구성</h2>
          <div style={{ height: 320, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" innerRadius={62} outerRadius={105} paddingAngle={4}>
                  {distribution.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="metric-list" style={{ padding: 0 }}>
            {distribution.map((entry, index) => (
              <div className="metric-row" key={entry.name}>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: COLORS[index % COLORS.length] }} />
                  {entry.name}
                </span>
                <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
