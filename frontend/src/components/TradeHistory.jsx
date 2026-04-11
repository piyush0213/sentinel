/**
 * TradeHistory — Recent trades table with emotion tags
 * Color-coded behavioral pattern pills and expandable details.
 */

import { useState, useContext } from 'react';
import { X, Clock, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { AppContext } from '../App';

const PATTERN_LABELS = {
  normal: { label: 'Normal', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  revenge_trade: { label: 'Revenge Trade', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  fomo_trade: { label: 'FOMO', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  overtrading: { label: 'Overtrading', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  late_night_trade: { label: 'Late Night', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' },
  panic_sell: { label: 'Panic Sell', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  herd_trade: { label: 'Tip-Based', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
};

const PATTERN_EXPLANATIONS = {
  revenge_trade: "This trade was placed shortly after a loss, a classic revenge trading pattern. Traders often try to immediately recover losses, leading to impulsive decisions with even larger losses.",
  fomo_trade: "Fear of Missing Out (FOMO) drove this trade. The position size was significantly larger than your average, suggesting emotional rather than analytical decision-making.",
  overtrading: "Multiple trades in a short window indicate overtrading. This pattern leads to higher transaction costs and emotional exhaustion, reducing decision quality.",
  late_night_trade: "Trading outside market hours typically involves lower liquidity and higher spreads. Late-night decisions are often driven by anxiety rather than analysis.",
  panic_sell: "This sell was triggered by a sudden portfolio drop. Panic selling locks in losses that often would have recovered naturally.",
  herd_trade: "This trade followed a social media tip. Tip-based trades historically underperform because by the time tips reach retail traders, the move has already happened.",
  normal: "This was a well-considered trade based on your typical trading patterns. Continue making decisions like this."
};

export default function TradeHistory({ trades: propTrades, limit = 10 }) {
  const ctx = useContext(AppContext);
  const [selectedTrade, setSelectedTrade] = useState(null);

  const trades = propTrades || ctx?.dashboardData?.recent_trades || [];
  const displayTrades = trades.slice(0, limit);

  const formatTime = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide">Recent Trades</h3>
          <span className="text-xs text-slate-500">{displayTrades.length} trades</span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Qty</th>
                <th>P&L</th>
                <th>Pattern</th>
              </tr>
            </thead>
            <tbody>
              {displayTrades.map((trade, i) => {
                const pattern = PATTERN_LABELS[trade.behavioral_pattern] || PATTERN_LABELS.normal;
                const isProfit = trade.pnl >= 0;
                return (
                  <tr key={trade.trade_id || i} onClick={() => setSelectedTrade(trade)}
                    className="fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-slate-300 font-medium">{formatTime(trade.timestamp)}</span>
                        <span className="text-[10px] text-slate-500">{formatDate(trade.timestamp)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm font-semibold text-slate-200">{trade.symbol}</span>
                    </td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${trade.trade_type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {trade.trade_type}
                      </span>
                    </td>
                    <td className="text-slate-400">{trade.quantity}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {isProfit ? <TrendingUp size={12} className="text-emerald-400" /> : <TrendingDown size={12} className="text-red-400" />}
                        <span className={`font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfit ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="emotion-pill" style={{ color: pattern.color, background: pattern.bg }}>
                        {pattern.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayTrades.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No trades to display
          </div>
        )}
      </div>

      {/* ── Trade Detail Drawer ── */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedTrade(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#13131A] border-l border-[#2A2A3A] h-full overflow-y-auto p-6 fade-in-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Trade Details</h3>
              <button onClick={() => setSelectedTrade(null)} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            {/* Trade info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#1A1A24] border border-[#2A2A3A]">
                <div>
                  <p className="text-lg font-bold text-white">{selectedTrade.symbol}</p>
                  <p className="text-xs text-slate-500">
                    {selectedTrade.trade_type} · {selectedTrade.quantity} qty · {formatTime(selectedTrade.timestamp)}
                  </p>
                </div>
                <div className={`text-xl font-bold ${selectedTrade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedTrade.pnl >= 0 ? '+' : ''}₹{Math.abs(selectedTrade.pnl).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Pattern badge */}
              {(() => {
                const p = PATTERN_LABELS[selectedTrade.behavioral_pattern] || PATTERN_LABELS.normal;
                return (
                  <div className="p-4 rounded-xl border" style={{ borderColor: p.color + '30', background: p.bg }}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={16} style={{ color: p.color }} />
                      <span className="font-bold text-sm" style={{ color: p.color }}>{p.label}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {PATTERN_EXPLANATIONS[selectedTrade.behavioral_pattern] || PATTERN_EXPLANATIONS.normal}
                    </p>
                  </div>
                );
              })()}

              {/* Trade metadata */}
              <div className="space-y-3 p-4 rounded-xl bg-[#1A1A24] border border-[#2A2A3A]">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Trade ID</span>
                  <span className="text-slate-300 font-mono">{selectedTrade.trade_id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Outcome</span>
                  <span className={selectedTrade.outcome === 'WIN' ? 'text-emerald-400' : 'text-red-400'}>{selectedTrade.outcome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Entry Price</span>
                  <span className="text-slate-300">₹{(selectedTrade.entry_price || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Exit Price</span>
                  <span className="text-slate-300">₹{(selectedTrade.exit_price || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
