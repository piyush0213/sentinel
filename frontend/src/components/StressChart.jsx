/**
 * StressChart — Portfolio stress test visualization
 * Bar chart showing portfolio value under 5 crash scenarios
 * with recovery time estimates and hedge recommendations.
 */

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Clock, Shield, TrendingDown, Loader2 } from 'lucide-react';
import axios from 'axios';
import { formatINR } from '../App';

const DEFAULT_PORTFOLIO = {
  portfolio_value: 500000,
  positions: [
    { symbol: 'RELIANCE', value: 100000, sector: 'Energy' },
    { symbol: 'TCS', value: 80000, sector: 'IT' },
    { symbol: 'HDFC', value: 75000, sector: 'Banking' },
    { symbol: 'ICICIBANK', value: 60000, sector: 'Banking' },
    { symbol: 'INFY', value: 55000, sector: 'IT' },
    { symbol: 'BAJFINANCE', value: 45000, sector: 'Finance' },
    { symbol: 'TATAMOTORS', value: 40000, sector: 'Auto' },
    { symbol: 'ITC', value: 45000, sector: 'FMCG' },
  ],
};

const SCENARIO_BARS = [
  { key: '2024_correction', label: '2024 Correction', shortLabel: '2024' },
  { key: 'flash_crash', label: 'Flash Crash', shortLabel: 'Flash' },
  { key: 'sector_collapse', label: 'Sector Collapse', shortLabel: 'Sector' },
  { key: '2020_crash', label: 'COVID-19 Crash', shortLabel: 'COVID' },
  { key: '2008_crisis', label: '2008 Crisis', shortLabel: '2008' },
];

function getBarColor(lossPct) {
  const pct = Math.abs(lossPct);
  if (pct < 15) return '#F59E0B';
  if (pct < 30) return '#EF4444';
  return '#DC2626';
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded-xl p-3 shadow-xl text-sm">
      <p className="font-bold text-white mb-1">{d.name}</p>
      <p className="text-slate-400">Portfolio: <span className="text-white font-semibold">{formatINR(d.value)}</span></p>
      <p className="text-red-400">Loss: <span className="font-semibold">{d.lossPct}%</span></p>
      <p className="text-slate-400">Recovery: <span className="text-amber-400">{d.recoveryDays} days</span></p>
    </div>
  );
};

export default function StressChart({ fullPage = false }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const portfolioValue = DEFAULT_PORTFOLIO.portfolio_value;

  const runStressTest = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/stress-test', {
        ...DEFAULT_PORTFOLIO,
        scenario: 'all',
      });
      setResults(res.data.results);
    } catch {
      // Mock fallback
      setResults(SCENARIO_BARS.map(s => ({
        scenario: s.key,
        scenario_name: s.label,
        projected_portfolio_value: portfolioValue * (1 - Math.random() * 0.5),
        projected_loss_percentage: -(Math.random() * 50 + 5).toFixed(1),
        recovery_days_estimate: Math.floor(Math.random() * 500 + 5),
        margin_call_risk: Math.random() > 0.7,
        recommended_hedge: [
          { type: 'NIFTY PUT', description: 'Buy NIFTY 50 PUT options' },
          { type: 'STOP LOSS', description: 'Set 5% stop losses' },
        ],
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runStressTest(); }, []);

  // Prepare chart data
  const chartData = results
    ? SCENARIO_BARS.map(s => {
      const r = results.find(x => x.scenario === s.key);
      return {
        name: s.label,
        shortName: s.shortLabel,
        value: r ? Math.round(r.projected_portfolio_value) : portfolioValue,
        lossPct: r ? Math.round(Math.abs(r.projected_loss_percentage)) : 0,
        recoveryDays: r?.recovery_days_estimate || 0,
        marginCall: r?.margin_call_risk || false,
        scenario: s.key,
        hedges: r?.recommended_hedge || [],
      };
    })
    : [];

  return (
    <div className={`glass-card ${fullPage ? '' : ''}`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingDown size={16} className="text-red-400" />
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide">Portfolio Stress Test</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Portfolio: {formatINR(portfolioValue)}</span>
          <button onClick={runStressTest} className="btn-primary text-xs py-1.5 px-4" disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Run Test'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          <Loader2 size={24} className="animate-spin mr-2" /> Running stress simulations...
        </div>
      ) : (
        <>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A24" vertical={false} />
                <XAxis dataKey="shortName" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `₹${(v / 100000).toFixed(1)}L`} domain={[0, portfolioValue * 1.1]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                <ReferenceLine y={portfolioValue} stroke="#6366F1" strokeDasharray="5 5" strokeWidth={2}
                  label={{ value: `Current: ${formatINR(portfolioValue)}`, position: 'top', fill: '#818CF8', fontSize: 11 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} cursor="pointer"
                  onClick={(entry) => setSelectedScenario(entry)}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={getBarColor(entry.lossPct)} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recovery time estimates */}
          <div className="grid grid-cols-5 gap-2 mt-2">
            {chartData.map((d, i) => (
              <div key={i} className="text-center p-2 rounded-lg bg-[#0F0F14] border border-[#2A2A3A]"
                onClick={() => setSelectedScenario(d)} style={{ cursor: 'pointer' }}>
                <p className="text-[10px] text-slate-500 mb-1">{d.shortName}</p>
                <p className="text-sm font-bold text-red-400">-{d.lossPct}%</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Clock size={9} className="text-amber-400" />
                  <span className="text-[10px] text-amber-400">{d.recoveryDays}d</span>
                </div>
                {d.marginCall && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <AlertTriangle size={9} className="text-red-400" />
                    <span className="text-[9px] text-red-400 font-bold">MARGIN CALL</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Selected scenario detail */}
          {selectedScenario && fullPage && (
            <div className="mt-4 p-4 rounded-xl bg-[#0F0F14] border border-[#2A2A3A] fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white">{selectedScenario.name}</h4>
                <span className="text-xs text-red-400 font-bold">Loss: {formatINR(portfolioValue - selectedScenario.value)}</span>
              </div>
              {selectedScenario.hedges?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Recommended Hedges</p>
                  {selectedScenario.hedges.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Shield size={12} className="text-indigo-400" />
                      <span className="text-indigo-300 font-medium">{h.type}:</span>
                      <span className="text-slate-400">{h.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
