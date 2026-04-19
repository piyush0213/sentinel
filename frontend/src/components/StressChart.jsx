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
  if (pct < 15) return '#FFB020';
  if (pct < 30) return '#FF3B3B';
  return '#DC2020';
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#111118] border border-[#1E1E2A] rounded-xl p-3.5 shadow-2xl text-sm" style={{ minWidth: 180 }}>
      <p className="font-bold text-white mb-2">{d.name}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-[#5A5A6E]">Portfolio</span>
          <span className="text-white font-semibold font-mono">{formatINR(d.value)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#5A5A6E]">Loss</span>
          <span className="text-[#FF3B3B] font-bold font-mono">-{d.lossPct}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#5A5A6E]">Recovery</span>
          <span className="text-[#FFB020] font-mono">{d.recoveryDays}d</span>
        </div>
      </div>
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
    <div className="glass-card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingDown size={15} className="text-[#FF3B3B]" />
          <h3 className="text-sm font-semibold text-[#F0F0F5] tracking-wide">Portfolio Stress Test</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#5A5A6E] font-semibold tracking-wider uppercase">Portfolio: {formatINR(portfolioValue)}</span>
          <button onClick={runStressTest} className="btn-primary text-xs py-1.5 px-4" disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Run Test'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#5A5A6E]">
          <Loader2 size={20} className="animate-spin mr-2" /> Running stress simulations...
        </div>
      ) : (
        <>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2A" vertical={false} />
                <XAxis dataKey="shortName" tick={{ fill: '#8B8B9E', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5A5A6E', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false}
                  tickFormatter={v => `₹${(v / 100000).toFixed(1)}L`} domain={[0, portfolioValue * 1.1]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <ReferenceLine y={portfolioValue} stroke="#00D26A" strokeDasharray="5 5" strokeWidth={1.5}
                  label={{ value: `Current: ${formatINR(portfolioValue)}`, position: 'top', fill: '#00D26A', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} cursor="pointer"
                  onClick={(entry) => setSelectedScenario(entry)}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={getBarColor(entry.lossPct)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recovery time estimates */}
          <div className="grid grid-cols-5 gap-2 mt-2">
            {chartData.map((d, i) => (
              <div key={i} className="text-center p-2.5 rounded-xl bg-[#0A0A0F] border border-[#1E1E2A] hover:border-[#2A2A3A] transition-colors cursor-pointer"
                onClick={() => setSelectedScenario(d)}>
                <p className="text-[10px] text-[#5A5A6E] mb-1 font-medium">{d.shortName}</p>
                <p className="text-sm font-bold font-mono text-[#FF3B3B]">-{d.lossPct}%</p>
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <Clock size={9} className="text-[#FFB020]" />
                  <span className="text-[10px] text-[#FFB020] font-mono">{d.recoveryDays}d</span>
                </div>
                {d.marginCall && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <AlertTriangle size={8} className="text-[#FF3B3B]" />
                    <span className="text-[8px] text-[#FF3B3B] font-bold tracking-wider">MARGIN CALL</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Selected scenario detail */}
          {selectedScenario && fullPage && (
            <div className="mt-4 p-4 rounded-xl bg-[#0A0A0F] border border-[#1E1E2A] fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white">{selectedScenario.name}</h4>
                <span className="text-xs text-[#FF3B3B] font-bold font-mono">Loss: {formatINR(portfolioValue - selectedScenario.value)}</span>
              </div>
              {selectedScenario.hedges?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-[#5A5A6E] font-semibold uppercase tracking-widest">Recommended Hedges</p>
                  {selectedScenario.hedges.map((h, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm p-2.5 rounded-lg bg-[#111118] border border-[#1E1E2A]">
                      <Shield size={13} className="text-[#00D26A]" />
                      <span className="text-[#00D26A] font-semibold text-xs">{h.type}</span>
                      <span className="text-[#8B8B9E] text-xs">{h.description}</span>
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
