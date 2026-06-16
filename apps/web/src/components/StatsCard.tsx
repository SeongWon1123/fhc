interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tone?: 'primary' | 'secondary' | 'warning' | 'danger';
}

const toneColor = {
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

export default function StatsCard({ title, value, change, icon: Icon, tone = 'primary' }: StatsCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className="card stat-card">
      <div className="stat-card-header">
        <span>{title}</span>
        <Icon size={20} color={toneColor[tone]} />
      </div>
      <div className="stat-value">{value}</div>
      <div>
        {change !== undefined && (
          <span className={`badge ${isNegative ? 'danger' : isPositive ? 'success' : 'warning'}`}>
            {isPositive ? '+' : isNegative ? '-' : ''}
            {Math.abs(change)}% 이번 달
          </span>
        )}
      </div>
    </div>
  );
}
