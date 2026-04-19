/**
 * CoolDownCard — The HERO component
 * Full-screen intervention modal with countdown timer,
 * breathing exercise, and historical pattern stats.
 */

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Clock, ShieldAlert, Heart } from 'lucide-react';
import { formatINR } from '../App';

export default function CoolDownCard({ data, onCancel, onProceed }) {
  const COOLDOWN_SECONDS = 60;
  const [timeLeft, setTimeLeft] = useState(COOLDOWN_SECONDS);
  const [timerDone, setTimerDone] = useState(false);
  const [breathPhase, setBreathPhase] = useState('inhale'); // inhale, hold, exhale
  const [breathCount, setBreathCount] = useState(4);
  const intervalRef = useRef(null);

  const pattern = data?.pattern || {};
  const trade = data?.trade || {};

  // ── Countdown timer ──
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setTimerDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Breathing exercise cycle: 4s inhale, 4s hold, 4s exhale ──
  useEffect(() => {
    const breathInterval = setInterval(() => {
      setBreathPhase(prev => {
        if (prev === 'inhale') return 'hold';
        if (prev === 'hold') return 'exhale';
        return 'inhale';
      });
      setBreathCount(4);
    }, 4000);

    // Count down within each phase
    const countInterval = setInterval(() => {
      setBreathCount(prev => (prev > 1 ? prev - 1 : 4));
    }, 1000);

    return () => {
      clearInterval(breathInterval);
      clearInterval(countInterval);
    };
  }, []);

  // Countdown ring progress
  const progress = ((COOLDOWN_SECONDS - timeLeft) / COOLDOWN_SECONDS);
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference * (1 - progress);

  const patternDisplay = {
    revenge_trade: 'REVENGE TRADE',
    fomo_trade: 'FOMO TRADE',
    overtrading: 'OVERTRADING',
    panic_sell: 'PANIC SELL',
    herd_trade: 'HERD TRADE',
    late_night_trade: 'LATE NIGHT TRADE',
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center cooldown-overlay">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-lg" />

      {/* Main card */}
      <div className="relative w-full max-w-lg mx-4 bg-[#0A0A0F] border-2 border-[#FF3B3B]/30 rounded-2xl p-8 cooldown-card overflow-y-auto max-h-[90vh] scale-in">

        {/* ── Header ── */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#FF3B3B]/10 flex items-center justify-center mb-4 danger-pulse">
            <ShieldAlert size={30} className="text-[#FF3B3B]" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            HOLD ON, RAHUL
          </h2>
          <p className="text-sm text-[#8B8B9E] mt-1">SENTINEL has detected a dangerous pattern</p>
        </div>

        {/* ── Risk Score ── */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <span className="text-sm text-[#5A5A6E] font-medium">Risk Score</span>
          <span className="text-3xl font-black font-mono text-[#FF3B3B]">{pattern.risk_score || 87}</span>
          <span className="text-lg text-[#5A5A6E] font-semibold font-mono">/100</span>
        </div>

        {/* ── Pattern Detection ── */}
        <div className="bg-[#FF3B3B]/8 border border-[#FF3B3B]/20 rounded-xl p-4 text-center mb-5">
          <p className="text-[10px] text-[#FF3B3B] font-bold uppercase tracking-widest mb-1">Detected Pattern</p>
          <p className="text-lg font-black text-[#FF3B3B]">
            {patternDisplay[pattern.pattern] || 'EMOTIONAL TRADE'} DETECTED
          </p>
          <p className="text-xs text-[#5A5A6E] mt-1.5">
            Attempting: <span className="text-[#8B8B9E] font-semibold">{trade.symbol} {trade.trade_type}</span> · <span className="font-mono">₹{(trade.position_size_inr || 0).toLocaleString('en-IN')}</span>
          </p>
        </div>

        {/* ── Historical Stats ── */}
        <div className="bg-[#FFB020]/6 border border-[#FFB020]/15 rounded-xl p-4 mb-5">
          <p className="text-[10px] text-[#FFB020] font-bold uppercase tracking-widest mb-3">
            Last {pattern.historical_count || 8} times in this pattern:
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Win rate', value: `${((pattern.historical_win_rate || 0.12) * 100).toFixed(0)}%` },
              { label: 'Average loss', value: formatINR(Math.abs(pattern.historical_avg_loss || 6400)) },
              { label: 'Total lost', value: formatINR(Math.abs(pattern.historical_total_loss || 51200)) },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded flex items-center justify-center bg-[#FF3B3B]/10 text-[#FF3B3B] text-[10px] font-bold shrink-0">✗</span>
                <span className="text-sm text-[#8B8B9E]">
                  {stat.label}: <span className="text-[#FF3B3B] font-bold font-mono">{stat.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Countdown Timer + Breathing ── */}
        <div className="flex flex-col items-center mb-6">
          {!timerDone ? (
            <>
              {/* Timer ring */}
              <div className="relative w-28 h-28 mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#111118" strokeWidth="5" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#FF3B3B" strokeWidth="5"
                    strokeLinecap="round" strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 6px rgba(255,59,59,0.3))' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white font-mono">{timeLeft}</span>
                  <span className="text-[9px] text-[#5A5A6E] uppercase tracking-widest mt-0.5">seconds</span>
                </div>
              </div>

              <p className="text-sm text-[#8B8B9E] font-medium mb-4">
                Take a breath. This trade can wait.
              </p>

              {/* Breathing exercise */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-[#3B82F6]/30 breathe-circle"
                    style={{
                      animationDuration: '12s',
                      background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Heart size={18} className="text-[#3B82F6]" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold capitalize" style={{
                    color: breathPhase === 'inhale' ? '#3B82F6' : breathPhase === 'hold' ? '#FFB020' : '#00D26A'
                  }}>
                    {breathPhase === 'inhale' ? '🫁 Breathe In' : breathPhase === 'hold' ? '⏸ Hold' : '💨 Breathe Out'}
                  </p>
                  <p className="text-xs text-[#5A5A6E] font-mono">{breathCount}s</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Timer complete — show action buttons */}
              <div className="w-full space-y-3">
                <p className="text-center text-sm text-[#5A5A6E] mb-4">
                  Timer complete. What would you like to do?
                </p>
                <button onClick={onCancel} className="btn-success w-full text-base py-3.5">
                  🛡️ Cancel Trade — Protect My Money
                </button>
                <button onClick={onProceed} className="btn-ghost w-full text-base py-3.5">
                  Proceed Anyway — I've Reconsidered
                </button>
              </div>
            </>
          )}
        </div>

        {/* AI Message */}
        {pattern.message && (
          <div className="mt-2 p-3.5 rounded-xl bg-[#111118] border border-[#1E1E2A]">
            <p className="text-xs text-[#8B8B9E] leading-relaxed">
              💡 {pattern.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
