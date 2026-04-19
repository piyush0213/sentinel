/**
 * TradeHistory — Recent trades table with emotion tags
 * Color-coded behavioral pattern pills and expandable details.
 */

import { useState, useContext } from 'react';
import { X, Clock, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { AppContext } from '../App';

const PATTERN_LABELS = {
  normal: { label: 'Normal', color: '#00D26A', bg: 'rgba(0,210,106,0.12)' },
  revenge_trade: { label: 'Revenge Trade', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)' },
  fomo_trade: { label: 'FOMO', color: '#FFB020', bg: 'rgba(255,176,32,0.12)' },
  overtrading: { label: 'Overtrading', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)' },
  late_night_trade: { label: 'Late Night', color: '#FFB020', bg: 'rgba(255,176,32,0.12)' },
  panic_sell: { label: 'Panic Sell', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)' },
  herd_trade: { label: 'Tip-Based', color: '#FFB020', bg: 'rgba(255,176,32,0.12)' },
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
          <h3 className="text-sm font-semibold text-[#F0F0F5] tracking-wide">Recent Trades</h3>
          <span className="text-[10px] text-[#5A5A6E] font-semibold tracking-wider uppercase">{displayTrades.length} trades</span>
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
                    className="fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-[#F0F0F5] font-medium font-mono text-xs">{formatTime(trade.timestamp)}</span>
                        <span className="text-[10px] text-[#5A5A6E]">{formatDate(trade.timestamp)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm font-semibold text-[#F0F0F5]">{trade.symbol}</span>
                    </td>
                    <td>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wider ${
                        trade.trade_type === 'BUY'
                          ? 'bg-[#00D26A] text-[#0A0A0F]'
                          : 'bg-[#FF3B3B] text-white'
                      }`}>
                        {trade.trade_type}
                      </span>
                    </td>
                    <td className="text-[#8B8B9E] font-mono text-xs">{trade.quantity}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {isProfit ? <TrendingUp size={12} className="text-[#00D26A]" /> : <TrendingDown size={12} className="text-[#FF3B3B]" />}
                        <span className={`font-bold font-mono text-sm ${isProfit ? 'text-[#00D26A]' : 'text-[#FF3B3B]'}`}>
                          {isProfit ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="emotion-pill" style={{ color: pattern.color, background: pattern.bg }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: pattern.color }} />
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
          <div className="text-center py-8 text-[#5A5A6E] text-sm">
            No trades to display
          </div>
        )}
      </div>

      {/* ── Trade Detail Drawer ── */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedTrade(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#0A0A0F] border-l border-[#1E1E2A] h-full overflow-y-auto p-6 slide-in-right"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Trade Details</h3>
              <button onClick={() => setSelectedTrade(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-[#5A5A6E] hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {/* Trade info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#111118] border border-[#1E1E2A]">
                <div>
                  <p className="text-lg font-bold text-white">{selectedTrade.symbol}</p>
                  <p className="text-xs text-[#5A5A6E]">
                    {selectedTrade.trade_type} · {selectedTrade.quantity} qty · {formatTime(selectedTrade.timestamp)}
                  </p>
                </div>
                <div className={`text-xl font-black font-mono ${selectedTrade.pnl >= 0 ? 'text-[#00D26A]' : 'text-[#FF3B3B]'}`}>
                  {selectedTrade.pnl >= 0 ? '+' : ''}₹{Math.abs(selectedTrade.pnl).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Pattern badge */}
              {(() => {
                const p = PATTERN_LABELS[selectedTrade.behavioral_pattern] || PATTERN_LABELS.normal;
                return (
                  <div className="p-4 rounded-xl border" style={{ borderColor: p.color + '20', background: p.bg }}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={15} style={{ color: p.color }} />
                      <span className="font-bold text-sm" style={{ color: p.color }}>{p.label}</span>
                    </div>
                    <p className="text-sm text-[#8B8B9E] leading-relaxed">
                      {PATTERN_EXPLANATIONS[selectedTrade.behavioral_pattern] || PATTERN_EXPLANATIONS.normal}
                    </p>
                  </div>
                );
              })()}

              {/* Trade metadata */}
              <div className="space-y-0 rounded-xl bg-[#111118] border border-[#1E1E2A] overflow-hidden">
                {[
                  { label: 'Trade ID', value: selectedTrade.trade_id, mono: true },
                  { label: 'Outcome', value: selectedTrade.outcome, color: selectedTrade.outcome === 'WIN' ? '#00D26A' : '#FF3B3B' },
                  { label: 'Entry Price', value: `₹${(selectedTrade.entry_price || 0).toLocaleString('en-IN')}` },
                  { label: 'Exit Price', value: `₹${(selectedTrade.exit_price || 0).toLocaleString('en-IN')}` },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between text-sm px-4 py-3 border-b border-[#1E1E2A] last:border-0">
                    <span className="text-[#5A5A6E]">{row.label}</span>
                    <span className={`${row.mono ? 'font-mono text-xs' : ''} ${row.color ? '' : 'text-[#F0F0F5]'}`}
                      style={row.color ? { color: row.color } : {}}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
