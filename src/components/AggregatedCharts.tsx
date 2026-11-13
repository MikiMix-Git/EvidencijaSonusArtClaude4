import { useMemo } from 'react';
import { BankStatementSummary, formatCurrency } from '../utils/BankStatementParser';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

interface AggregatedChartsProps {
  summary: BankStatementSummary;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6'];

export function AggregatedCharts({ summary }: AggregatedChartsProps) {
  const { transactions, currency } = summary;

  const dailyData = useMemo(() => {
    const grouped: Record<string, { date: string; income: number; expense: number }> = {};
    transactions.forEach((t) => {
      if (!grouped[t.date]) grouped[t.date] = { date: t.date, income: 0, expense: 0 };
      grouped[t.date].income += t.credit;
      grouped[t.date].expense += t.debit;
    });
    return Object.values(grouped).sort((a, b) => {
      const [dA, mA, yA] = a.date.split('.').map(Number);
      const [dB, mB, yB] = b.date.split('.').map(Number);
      return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
    });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const grouped: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.debit > 0) {
        const cat = t.category || 'Ostalo';
        grouped[cat] = (grouped[cat] || 0) + t.debit;
      }
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const balanceData = useMemo(() => {
    return transactions.filter((t) => t.balance !== undefined).map((t) => ({ date: t.date, balance: t.balance }));
  }, [transactions]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm text-slate-300 mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-sm font-mono" style={{ color: p.color }}>{p.name}: {formatCurrency(p.value, currency)}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {dailyData.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Dnevni prilivi i odlivi (svi izvodi)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Prilivi" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" name="Odlivi" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {categoryData.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Odlivi po kategorijama</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                    {categoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value, currency)} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {categoryData.slice(0, 8).map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-400">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {balanceData.length > 1 && (
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Kretanje salda (svi izvodi)</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="balance" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} name="Saldo" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
