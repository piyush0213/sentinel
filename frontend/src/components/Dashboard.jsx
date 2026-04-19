/**
 * Dashboard — Main trading dashboard layout
 * Shows metric cards, risk gauge, behavioral summary,
 * trade history, and stress chart in a responsive grid.
 */

import { useContext } from 'react';
import {
  Zap, TrendingDown, AlertTriangle, DollarSign,
  Brain, Calendar, Clock, Award, Target, Activity, BarChart2
} from 'lucide-react';
import { AppContext, formatINR } from '../App';
import RiskGauge from './RiskGauge';
import TradeHistory from './TradeHistory';
import StressChart from './StressChart';

const PATTERN_DISPLAY = {
  revenge_trade: 'Revenge Trading',
  fomo_trade: 'FOMO Trading',
  overtrading: 'Overtrading',
  late_night_trade: 'Late Night Trading',
  panic_sell: 'Panic Selling',
  herd_trade: 'Herd/Tip Trading',
  normal: 'None',
  none: 'None'
};

export default function Dashboard() {
  const ctx = useContext(AppContext);
  const data = ctx?.dashboardData;

  if (ctx?.loading || !data) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 metric-grid-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="shimmer h-[120px]" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 shimmer h-64" />
          <div className="lg:col-span-2 shimmer h-64" />
        </div>
        <div className="shimmer h-72" />
      </div>
    );
  }

  const summary = data.behavioral_summary || {};

  // Determine risk accent class
  const riskAccent = ctx.riskScore < 30 ? 'accent-green' : ctx.riskScore < 60 ? 'accent-amber' : 'accent-red';
  const riskTextColor = ctx.riskScore < 30 ? 'text-[#00D26A]' : ctx.riskScore < 60 ? 'text-[#FFB020]' : 'text-[#FF3B3B]';

  return (
    <div className="space-y-5">
      {/* ═══ Row 1: Metric Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 metric-grid-4">

        {/* Live Risk Score */}
        <div className={`metric-card ${riskAccent}`}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${ctx.riskColor}15` }}>
              <Zap size={15} style={{ color: ctx.riskColor }} />
            </div>
            <span className="text-[10px] text-[#5A5A6E] font-semibold uppercase tracking-widest">Live Risk</span>
          </div>
          <p className="text-3xl font-black font-mono" style={{ color: ctx.riskColor }}>
            {ctx.riskScore}<span className="text-base font-semibold text-[#5A5A6E] ml-0.5">/100</span>
          </p>
          <p className="text-[11px] mt-1.5 font-bold tracking-widest" style={{ color: ctx.riskColor }}>
            {ctx.riskLabel}
          </p>
        </div>

        {/* Today's P&L */}
        <div className={`metric-card ${data.pnl_today >= 0 ? 'accent-green' : 'accent-red'}`}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.pnl_today >= 0 ? 'bg-[#00D26A]/10' : 'bg-[#FF3B3B]/10'}`}>
              <DollarSign size={15} className={data.pnl_today >= 0 ? 'text-[#00D26A]' : 'text-[#FF3B3B]'} />
            </div>
            <span className="text-[10px] text-[#5A5A6E] font-semibold uppercase tracking-widest">Today's P&L</span>
          </div>
          <p className={`text-3xl font-black font-mono ${data.pnl_today >= 0 ? 'text-[#00D26A]' : 'text-[#FF3B3B]'}`}>
            {formatINR(data.pnl_today)}
          </p>
          <p className="text-[11px] text-[#5A5A6E] mt-1.5">
            {data.total_trades_today} trades today
          </p>
        </div>

        {/* Emotional Trades Today */}
        <div className={`metric-card ${data.emotional_trades_today > 2 ? 'accent-red' : data.emotional_trades_today > 0 ? 'accent-amber' : 'accent-green'}`}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FFB020]/10">
              <AlertTriangle size={15} className="text-[#FFB020]" />
            </div>
            <span className="text-[10px] text-[#5A5A6E] font-semibold uppercase tracking-widest">Emotional Trades</span>
          </div>
          <p className="text-3xl font-black font-mono text-[#FFB020]">
            {data.emotional_trades_today}
          </p>
          <p className="text-[11px] text-[#5A5A6E] mt-1.5">
            out of {data.total_trades_today} today
          </p>
        </div>

        {/* Monthly Emotional Loss */}
        <div className="metric-card accent-red">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FF3B3B]/10">
              <TrendingDown size={15} className="text-[#FF3B3B]" />
            </div>
            <span className="text-[10px] text-[#5A5A6E] font-semibold uppercase tracking-widest">Emotional Losses</span>
          </div>
          <p className="text-3xl font-black font-mono text-[#FF3B3B]">
            {formatINR(data.emotional_loss_this_month)}
          </p>
          <p className="text-[11px] text-[#5A5A6E] mt-1.5">
            this month from bad patterns
          </p>
        </div>
      </div>

      {/* ═══ Row 2: Risk Gauge + Behavioral Summary ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Risk Gauge */}
        <div className="lg:col-span-3 glass-card flex items-center justify-center py-6">
          <RiskGauge size={300} />
        </div>

        {/* Behavioral Summary */}
        <div className="lg:col-span-2 glass-card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Brain size={15} className="text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#F0F0F5] tracking-wide">Behavioral Summary</h3>
          </div>
          <p className="text-[10px] text-[#5A5A6E] -mt-3 tracking-wider">30-DAY ANALYSIS</p>

          {/* Worst pattern */}
          <div className="p-3.5 rounded-xl bg-[#FF3B3B]/5 border border-[#FF3B3B]/15">
            <p className="text-[10px] text-[#FF3B3B] font-bold uppercase tracking-widest mb-1">Worst Pattern</p>
            <p className="text-base font-bold text-[#FF3B3B]">
              {PATTERN_DISPLAY[summary.worst_pattern] || summary.worst_pattern}
            </p>
            <p className="text-[11px] text-[#5A5A6E] mt-1">
              {summary.worst_pattern_count} occurrences · {summary.emotional_win_rate}% win rate
            </p>
          </div>

          {/* Recoverable losses */}
          <div className="p-3.5 rounded-xl bg-[#00D26A]/5 border border-[#00D26A]/15">
            <p className="text-[10px] text-[#00D26A] font-bold uppercase tracking-widest mb-1">Recoverable Losses</p>
            <p className="text-xl font-black font-mono text-[#00D26A]">
              {formatINR(summary.estimated_recoverable_losses)}
            </p>
            <p className="text-[11px] text-[#5A5A6E] mt-1">
              estimated savings if emotional trades were avoided
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#111118]">
              <Calendar size={12} className="text-[#5A5A6E]" />
              <div>
                <p className="text-[10px] text-[#5A5A6E]">Best Day</p>
                <p className="text-xs text-[#00D26A] font-semibold">{summary.best_day_of_week}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#111118]">
              <Calendar size={12} className="text-[#5A5A6E]" />
              <div>
                <p className="text-[10px] text-[#5A5A6E]">Worst Day</p>
                <p className="text-xs text-[#FF3B3B] font-semibold">{summary.worst_day_of_week}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#111118]">
              <Target size={12} className="text-[#5A5A6E]" />
              <div>
                <p className="text-[10px] text-[#5A5A6E]">Normal Win Rate</p>
                <p className="text-xs text-[#00D26A] font-semibold">{summary.normal_win_rate}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#111118]">
              <Award size={12} className="text-[#5A5A6E]" />
              <div>
                <p className="text-[10px] text-[#5A5A6E]">Emotional Win Rate</p>
                <p className="text-xs text-[#FF3B3B] font-semibold">{summary.emotional_win_rate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Row 3: Trade History ═══ */}
      <TradeHistory />

      {/* ═══ Row 4: Stress Chart ═══ */}
      <StressChart />
    </div>
  );
}
