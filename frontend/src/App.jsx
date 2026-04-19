/**
 * SENTINEL — Main Application
 * AI-Powered Behavioral Finance Protection Layer
 * 
 * Core philosophy: Don't block trades. Give traders a mirror.
 */

import { useState, useEffect, useCallback, createContext } from 'react';
import {
  Shield, LayoutDashboard, BarChart3, SearchCheck,
  MessageCircle, Activity, Zap, Play, User, TrendingUp,
  Menu, X
} from 'lucide-react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import CoolDownCard from './components/CoolDownCard';
import MisinfoShield from './components/MisinfoShield';
import FinanceCoach from './components/FinanceCoach';
import StressChart from './components/StressChart';

// ── API base URL (falls back to mock if backend is down) ──
const API_BASE = '/api';

// ── Global App Context ──
export const AppContext = createContext(null);

// ── Indian number formatting ──
export function formatINR(num) {
  if (num === null || num === undefined) return '₹0';
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (absNum >= 10000000) return `${sign}₹${(absNum / 10000000).toFixed(2)} Cr`;
  if (absNum >= 100000) return `${sign}₹${(absNum / 100000).toFixed(2)} L`;
  // Indian comma format
  const formatted = absNum.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return `${sign}₹${formatted}`;
}

// ── Mock dashboard data (fallback when backend is offline) ──
const MOCK_DASHBOARD = {
  user: { name: 'Rahul Sharma', user_id: 'user_001' },
  risk_score: 32,
  risk_label: 'SAFE',
  risk_color: '#00D26A',
  risk_breakdown: { loss_recency: 10, trade_frequency: 15, position_sizing: 5, time_of_day: 0, social_tips: 0 },
  risk_trend: Array.from({ length: 8 }, (_, i) => ({ date: `2026-04-${4 + i}`, score: 20 + Math.random() * 25 })),
  total_trades_today: 6,
  emotional_trades_today: 1,
  pnl_today: 3200,
  pnl_this_month: -12400,
  emotional_loss_this_month: 28600,
  worst_pattern: 'revenge_trade',
  behavioral_summary: {
    total_trades: 142, total_emotional_trades: 38,
    emotional_trade_percentage: 26.8, emotional_trade_loss: 51200,
    worst_pattern: 'revenge_trade', worst_pattern_count: 14,
    best_day_of_week: 'Tuesday', worst_day_of_week: 'Friday',
    best_hour_of_day: 10, worst_hour_of_day: 15,
    normal_win_rate: 54.2, emotional_win_rate: 18.4,
    estimated_recoverable_losses: 35840, total_pnl: -8200,
  },
  recent_trades: [
    { trade_id: 'TRD-0491', timestamp: '2026-04-11T10:15:00', symbol: 'RELIANCE', trade_type: 'BUY', quantity: 10, pnl: 1200, behavioral_pattern: 'normal', outcome: 'WIN', emotion_tag: { label: 'Normal', color: '#00D26A', severity: 0 } },
    { trade_id: 'TRD-0492', timestamp: '2026-04-11T10:32:00', symbol: 'TCS', trade_type: 'SELL', quantity: 5, pnl: -3400, behavioral_pattern: 'normal', outcome: 'LOSS', emotion_tag: { label: 'Normal', color: '#00D26A', severity: 0 } },
    { trade_id: 'TRD-0493', timestamp: '2026-04-11T10:38:00', symbol: 'BANKNIFTY', trade_type: 'BUY', quantity: 25, pnl: -6800, behavioral_pattern: 'revenge_trade', outcome: 'LOSS', emotion_tag: { label: 'Revenge Trade', color: '#FF3B3B', severity: 5 } },
    { trade_id: 'TRD-0494', timestamp: '2026-04-11T11:05:00', symbol: 'INFY', trade_type: 'BUY', quantity: 15, pnl: 2100, behavioral_pattern: 'normal', outcome: 'WIN', emotion_tag: { label: 'Normal', color: '#00D26A', severity: 0 } },
    { trade_id: 'TRD-0495', timestamp: '2026-04-11T11:22:00', symbol: 'SBIN', trade_type: 'BUY', quantity: 20, pnl: -1800, behavioral_pattern: 'fomo_trade', outcome: 'LOSS', emotion_tag: { label: 'FOMO', color: '#FFB020', severity: 3 } },
  ],
};

// ── Demo mode scenario steps ──
const DEMO_STEPS = [
  { delay: 0, riskScore: 32, label: 'SAFE', color: '#00D26A', event: null },
  {
    delay: 3000, riskScore: 58, label: 'CAUTION', color: '#FFB020',
    event: {
      type: 'trade',
      trade: { symbol: 'RELIANCE', trade_type: 'SELL', pnl: -4200, behavioral_pattern: 'normal', outcome: 'LOSS', quantity: 15, emotion_tag: { label: 'Normal', color: '#00D26A' } },
      toast: '📉 Trade executed: RELIANCE SELL — Loss ₹4,200'
    }
  },
  {
    delay: 6000, riskScore: 87, label: 'DANGER', color: '#FF3B3B',
    event: {
      type: 'cooldown',
      trade: { symbol: 'BANKNIFTY', trade_type: 'BUY', position_size_inr: 85000, quantity: 50 },
      pattern: {
        pattern: 'revenge_trade', confidence: 0.91, risk_score: 87,
        historical_win_rate: 0.12, historical_avg_loss: -6400,
        historical_total_loss: -51200, historical_count: 8,
        message: "You've placed 3 trades in 4 minutes after your last loss of ₹4,200. Your win rate in this pattern: 12%. Average loss: ₹6,400.",
        intervention_needed: true,
      }
    }
  },
];

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [riskScore, setRiskScore] = useState(32);
  const [riskLabel, setRiskLabel] = useState('SAFE');
  const [riskColor, setRiskColor] = useState('#00D26A');

  // Demo mode state
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  // CoolDown modal state
  const [showCoolDown, setShowCoolDown] = useState(false);
  const [coolDownData, setCoolDownData] = useState(null);

  // Confetti state
  const [showConfetti, setShowConfetti] = useState(false);
  const [savingsMessage, setSavingsMessage] = useState(null);

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Fetch dashboard data ──
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/dashboard-stats/user_001`);
      setDashboardData(res.data);
      setRiskScore(res.data.risk_score);
      setRiskLabel(res.data.risk_label);
      setRiskColor(res.data.risk_color);
    } catch {
      // Fall back to mock data if backend is down
      setDashboardData(MOCK_DASHBOARD);
      setRiskScore(MOCK_DASHBOARD.risk_score);
      setRiskLabel(MOCK_DASHBOARD.risk_label);
      setRiskColor(MOCK_DASHBOARD.risk_color);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── Demo mode runner ──
  const startDemo = useCallback(() => {
    setDemoMode(true);
    setDemoStep(0);
    setActivePage('dashboard');
    setShowCoolDown(false);
    setSavingsMessage(null);
    setSidebarOpen(false);

    // Reset to initial state
    setRiskScore(32);
    setRiskLabel('SAFE');
    setRiskColor('#00D26A');

    // Run each step
    DEMO_STEPS.forEach((step, idx) => {
      setTimeout(() => {
        setDemoStep(idx);
        setRiskScore(step.riskScore);
        setRiskLabel(step.label);
        setRiskColor(step.color);

        if (step.event?.type === 'trade') {
          setToastMessage(step.event.toast);
          setTimeout(() => setToastMessage(null), 3000);
          // Add trade to dashboard
          setDashboardData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              risk_score: step.riskScore,
              risk_label: step.label,
              risk_color: step.color,
              pnl_today: (prev.pnl_today || 0) + step.event.trade.pnl,
              recent_trades: [
                { ...step.event.trade, trade_id: `DEMO-${idx}`, timestamp: new Date().toISOString() },
                ...(prev.recent_trades || []),
              ].slice(0, 10)
            };
          });
        }

        if (step.event?.type === 'cooldown') {
          setCoolDownData(step.event);
          setShowCoolDown(true);
        }
      }, step.delay);
    });
  }, []);

  const handleCoolDownCancel = () => {
    setShowCoolDown(false);
    setRiskScore(45);
    setRiskLabel('CAUTION');
    setRiskColor('#FFB020');
    setSavingsMessage('Trade avoided. Estimated saving: ₹6,400 based on your pattern history.');
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
    setTimeout(() => setSavingsMessage(null), 6000);
  };

  const handleCoolDownProceed = () => {
    setShowCoolDown(false);
    setToastMessage('Override logged. Good luck, Rahul.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Navigation items ──
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stress-test', label: 'Stress Test', icon: BarChart3 },
    { id: 'tip-checker', label: 'Tip Checker', icon: SearchCheck },
    { id: 'ai-coach', label: 'AI Coach', icon: MessageCircle },
  ];

  // ── Risk badge color ──
  const getRiskBg = (score) => {
    if (score < 30) return 'bg-[#00D26A]/15 text-[#00D26A] border border-[#00D26A]/25';
    if (score < 60) return 'bg-[#FFB020]/15 text-[#FFB020] border border-[#FFB020]/25';
    return 'bg-[#FF3B3B]/15 text-[#FF3B3B] border border-[#FF3B3B]/25';
  };

  const handleNavClick = (id) => {
    setActivePage(id);
    setSidebarOpen(false);
  };

  const contextValue = { dashboardData, riskScore, riskLabel, riskColor, formatINR, loading, demoMode };

  // ── Page titles ──
  const pageTitles = {
    'dashboard': 'Trading Dashboard',
    'stress-test': 'Portfolio Stress Test',
    'tip-checker': 'Misinformation Shield',
    'ai-coach': 'AI Finance Coach',
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex h-screen overflow-hidden bg-[#0A0A0F]">

        {/* ═══ Mobile sidebar overlay ═══ */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* ═══ Sidebar ═══ */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[220px] bg-[#0A0A0F] border-r border-[#1E1E2A]
          flex flex-col py-5 px-3 shrink-0
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Logo */}
          <div className="flex items-center gap-3 px-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-[#111118] border border-[#1E1E2A] flex items-center justify-center">
              <Shield size={18} className="text-[#00D26A]" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-white">SENTINEL</h1>
              <p className="text-[10px] text-[#5A5A6E] tracking-widest font-medium">BEHAVIORAL SHIELD</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex flex-col gap-1 flex-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`sidebar-link ${activePage === item.id ? 'active' : ''}`}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Demo mode button */}
          <button onClick={startDemo} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#111118] border border-[#00D26A]/30 text-[#00D26A] text-sm font-semibold hover:bg-[#00D26A]/10 hover:border-[#00D26A]/50 transition-all mt-4">
            <Play size={14} />
            Live Demo
          </button>

          {/* User profile */}
          <div className="flex items-center gap-3 px-3 pt-4 mt-4 border-t border-[#1E1E2A]">
            <div className="w-8 h-8 rounded-lg bg-[#1A1A24] border border-[#1E1E2A] flex items-center justify-center">
              <User size={14} className="text-[#8B8B9E]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#F0F0F5] truncate">Rahul Sharma</p>
              <p className="text-[10px] text-[#5A5A6E]">Retail Trader</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#00D26A] ml-auto pulse-subtle" />
          </div>
        </aside>

        {/* ═══ Main Area ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Top Bar */}
          <header className="h-[52px] bg-[#0A0A0F] border-b border-[#1E1E2A] flex items-center justify-between px-5 shrink-0 z-10">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 text-[#8B8B9E] transition">
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>

              {/* Page title */}
              <div className="flex items-center gap-2.5">
                {demoMode && (
                  <span className="flex items-center gap-1.5 text-[#00D26A] text-xs font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00D26A] animate-pulse" />
                    DEMO
                  </span>
                )}
                <span className="text-sm font-medium text-[#8B8B9E]">
                  {pageTitles[activePage]}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Live risk badge */}
              <div className={`risk-badge ${getRiskBg(riskScore)}`} style={{ transition: 'all 0.5s ease' }}>
                <Zap size={11} />
                <span>RISK {riskScore}</span>
                <span className="opacity-40 text-[10px]">/100</span>
              </div>

              {/* P&L badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{
                background: (dashboardData?.pnl_today ?? 0) >= 0 ? 'rgba(0,210,106,0.08)' : 'rgba(255,59,59,0.08)',
              }}>
                <TrendingUp size={13} className={(dashboardData?.pnl_today ?? 0) >= 0 ? 'text-[#00D26A]' : 'text-[#FF3B3B]'} />
                <span className={`text-sm font-bold font-mono ${(dashboardData?.pnl_today ?? 0) >= 0 ? 'text-[#00D26A]' : 'text-[#FF3B3B]'}`}>
                  {formatINR(dashboardData?.pnl_today || 0)}
                </span>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-5 lg:p-6">
            {/* Toast notification */}
            {toastMessage && (
              <div className="fixed top-3 right-4 z-50 bg-[#111118] border border-[#1E1E2A] rounded-xl px-4 py-3 shadow-2xl fade-in-up text-sm text-[#F0F0F5] flex items-center gap-3 max-w-sm">
                <div className="w-1 h-8 rounded-full bg-[#FFB020] shrink-0" />
                {toastMessage}
              </div>
            )}

            {/* Savings message */}
            {savingsMessage && (
              <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-[#00D26A]/8 border border-[#00D26A]/25 rounded-xl px-6 py-3.5 shadow-2xl fade-in-up text-sm text-[#00D26A] font-semibold max-w-md text-center" style={{ boxShadow: '0 0 40px rgba(0,210,106,0.1)' }}>
                🎉 {savingsMessage}
              </div>
            )}

            {/* Confetti */}
            {showConfetti && (
              <div className="fixed inset-0 pointer-events-none z-[100]">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div
                    key={i}
                    className="confetti-piece"
                    style={{
                      left: `${Math.random() * 100}%`,
                      backgroundColor: ['#00D26A', '#FF3B3B', '#FFB020', '#3B82F6', '#00D26A', '#FFB020'][i % 6],
                      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                      width: `${6 + Math.random() * 8}px`,
                      height: `${6 + Math.random() * 8}px`,
                      animationDelay: `${Math.random() * 1.5}s`,
                      animationDuration: `${2 + Math.random() * 2}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Pages */}
            {activePage === 'dashboard' && <Dashboard />}
            {activePage === 'stress-test' && <StressChart fullPage />}
            {activePage === 'tip-checker' && <MisinfoShield />}
            {activePage === 'ai-coach' && <FinanceCoach />}
          </main>
        </div>

        {/* CoolDown Modal */}
        {showCoolDown && coolDownData && (
          <CoolDownCard
            data={coolDownData}
            onCancel={handleCoolDownCancel}
            onProceed={handleCoolDownProceed}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}
