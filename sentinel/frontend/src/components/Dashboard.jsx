/**
 * Dashboard — Main trading dashboard layout
 * Shows metric cards, risk gauge, behavioral summary,
 * trade history, and stress chart in a responsive grid.
 */

import { useContext } from 'react';
import {
  Zap, TrendingDown, AlertTriangle, DollarSign,
  Brain, Calendar, Clock, Award, Target
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
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="shimmer h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 shimmer h-64 rounded-2xl" />
          <div className="col-span-2 shimmer h-64 rounded-2xl" />
        </div>
        <div className="shimmer h-72 rounded-2xl" />
      </div>
    );
  }

  const summary = data.behavioral_summary || {};

  return (
    <div className="space-y-5">
      {/* ═══ Row 1: Metric Cards ═══ */}
      <div className="grid grid-cols-4 gap-4">
        {/* Live Risk Score */}
        <div className={`metric-card ${ctx.riskScore < 30 ? 'success' : ctx.riskScore < 60 ? 'warning' : 'danger'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${ctx.riskColor}20` }}>
              <Zap size={16} style={{ color: ctx.riskColor }} />
            </div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Live Risk</span>
          </div>
          <p className="text-3xl font-black" style={{ color: ctx.riskColor }}>
            {ctx.riskScore}<span className="text-base font-semibold text-slate-500">/100</span>
          </p>
          <p className="text-xs mt-1 font-semibold tracking-wider" style={{ color: ctx.riskColor }}>
            {ctx.riskLabel}
          </p>
        </div>

        {/* Today's P&L */}
        <div className={`metric-card ${data.pnl_today >= 0 ? 'success' : 'danger'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.pnl_today >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              <DollarSign size={16} className={data.pnl_today >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            </div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Today's P&L</span>
          </div>
          <p className={`text-3xl font-black ${data.pnl_today >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatINR(data.pnl_today)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {data.total_trades_today} trades today
          </p>
        </div>

        {/* Emotional Trades Today */}
        <div className={`metric-card ${data.emotional_trades_today > 2 ? 'danger' : data.emotional_trades_today > 0 ? 'warning' : 'success'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/20">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Emotional Trades</span>
          </div>
          <p className="text-3xl font-black text-amber-400">
            {data.emotional_trades_today}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            out of {data.total_trades_today} today
          </p>
        </div>

        {/* Monthly Emotional Loss */}
        <div className="metric-card danger">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/20">
              <TrendingDown size={16} className="text-red-400" />
            </div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Emotional Losses</span>
          </div>
          <p className="text-3xl font-black text-red-400">
            {formatINR(data.emotional_loss_this_month)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            this month from bad patterns
          </p>
        </div>
      </div>

      {/* ═══ Row 2: Risk Gauge + Behavioral Summary ═══ */}
      <div className="grid grid-cols-5 gap-4">
        {/* Risk Gauge */}
        <div className="col-span-3 glass-card flex items-center justify-center py-6">
          <RiskGauge size={300} />
        </div>

        {/* Behavioral Summary */}
        <div className="col-span-2 glass-card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Brain size={16} className="text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200 tracking-wide">Behavioral Summary</h3>
          </div>
          <p className="text-[11px] text-slate-500 -mt-3">30-day analysis</p>

          {/* Worst pattern */}
          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1">Worst Pattern</p>
            <p className="text-base font-bold text-red-300">
              {PATTERN_DISPLAY[summary.worst_pattern] || summary.worst_pattern}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {summary.worst_pattern_count} occurrences · {summary.emotional_win_rate}% win rate
            </p>
          </div>

          {/* Recoverable losses */}
          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">Recoverable Losses</p>
            <p className="text-xl font-black text-indigo-300">
              {formatINR(summary.estimated_recoverable_losses)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              estimated savings if emotional trades were avoided
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-slate-500" />
              <div>
                <p className="text-[10px] text-slate-500">Best Day</p>
                <p className="text-xs text-emerald-400 font-semibold">{summary.best_day_of_week}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-slate-500" />
              <div>
                <p className="text-[10px] text-slate-500">Worst Day</p>
                <p className="text-xs text-red-400 font-semibold">{summary.worst_day_of_week}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Target size={12} className="text-slate-500" />
              <div>
                <p className="text-[10px] text-slate-500">Normal Win Rate</p>
                <p className="text-xs text-emerald-400 font-semibold">{summary.normal_win_rate}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Award size={12} className="text-slate-500" />
              <div>
                <p className="text-[10px] text-slate-500">Emotional Win Rate</p>
                <p className="text-xs text-red-400 font-semibold">{summary.emotional_win_rate}%</p>
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
