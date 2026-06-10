'use client';

import { useEffect, useState } from 'react';

interface HealthMetrics {
  visibility: number;
  engagement: number;
  reputation: number;
  leadCapture: number;
  overall: number;
}

interface ClientHealth {
  clientId: string;
  businessName: string;
  status: 'green' | 'amber' | 'red';
  score: number;
  metrics: HealthMetrics;
  lastActivity: string | null;
  openTasks: number;
  alerts: string[];
}

interface DashboardData {
  summary: {
    total: number;
    green: number;
    amber: number;
    red: number;
    averageScore: number;
  };
  clients: ClientHealth[];
}

export function AgencyHealthDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthData();
  }, []);

  async function fetchHealthData() {
    try {
      const response = await fetch('/api/agency/health');
      if (!response.ok) throw new Error('Failed to fetch health data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-slate-600">Loading health dashboard...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!data) return <div className="p-8">No data available</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Agency Health Dashboard</h1>
          <p className="text-slate-500 mt-1">Real-time health scores for all clients</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="green" count={data.summary.green} />
          <StatusBadge status="amber" count={data.summary.amber} />
          <StatusBadge status="red" count={data.summary.red} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Average Score"
          value={data.summary.averageScore}
          color="blue"
        />
        <SummaryCard
          title="Healthy Clients"
          value={data.summary.green}
          color="green"
        />
        <SummaryCard
          title="Needs Attention"
          value={data.summary.amber}
          color="yellow"
        />
        <SummaryCard
          title="Critical"
          value={data.summary.red}
          color="red"
        />
      </div>

      {/* Client List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Client Status</h2>
        {data.clients.length === 0 ? (
          <div className="text-slate-500 p-8 text-center bg-slate-50 rounded-xl">
            No clients found. Add clients to see their health scores.
          </div>
        ) : (
          data.clients.map((client) => (
            <ClientCard key={client.clientId} client={client} />
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, count }: { status: 'green' | 'amber' | 'red'; count: number }) {
  const colors = {
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    red: 'bg-red-100 text-red-800 border-red-200'
  };

  const labels = {
    green: 'Healthy',
    amber: 'Attention',
    red: 'Critical'
  };

  return (
    <div className={`px-4 py-2 rounded-lg border ${colors[status]} flex items-center gap-2`}>
      <span className="font-medium">{labels[status]}</span>
      <span className="bg-white/50 px-2 py-0.5 rounded-full text-sm font-bold">{count}</span>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  color
}: {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200'
  };

  return (
    <div className={`rounded-xl border p-6 ${colors[color]}`}>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="text-3xl font-bold mt-1 text-slate-900">{value}</p>
    </div>
  );
}

function ClientCard({ client }: { client: ClientHealth }) {
  const statusColors = {
    green: 'border-l-green-500',
    amber: 'border-l-yellow-500',
    red: 'border-l-red-500'
  };

  const statusBg = {
    green: 'bg-green-50/30',
    amber: 'bg-yellow-50/30',
    red: 'bg-red-50/30'
  };

  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 ${statusColors[client.status]} ${statusBg[client.status]} hover:shadow-md transition-shadow`}>
      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Business Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-slate-900">{client.businessName}</h3>
              <StatusBadge status={client.status} count={client.score} />
            </div>

            {/* Alerts */}
            {client.alerts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {client.alerts.map((alert, i) => (
                  <span
                    key={i}
                    className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full"
                  >
                    {alert}
                  </span>
                ))}
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <MetricBar
                label="Visibility"
                value={client.metrics.visibility}
              />
              <MetricBar
                label="Engagement"
                value={client.metrics.engagement}
              />
              <MetricBar
                label="Reputation"
                value={client.metrics.reputation}
              />
              <MetricBar
                label="Leads"
                value={client.metrics.leadCapture}
              />
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="text-right lg:ml-6 lg:text-right">
            <div className="text-sm text-slate-500">
              {client.openTasks > 0 && (
                <p className="text-orange-600 font-medium">{client.openTasks} open tasks</p>
              )}
              {client.lastActivity && (
                <p className="text-slate-400 text-xs mt-1">
                  Last activity: {formatDate(client.lastActivity)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  const getColor = (v: number) => {
    if (v >= 70) return 'bg-green-500';
    if (v >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(value)} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-IE', { month: 'short', day: 'numeric' });
}
