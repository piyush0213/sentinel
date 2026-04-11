/**
 * MisinfoShield — Stock tip checker
 * Analyzes tips for pump-and-dump patterns, urgency language,
 * and unrealistic return promises using the backend NLP engine.
 */

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Search, ExternalLink, Info, Zap } from 'lucide-react';
import axios from 'axios';

const RISK_STYLES = {
  HIGH: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  MEDIUM: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  LOW: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const FLAG_ICONS = {
  urgency_language: '⏰',
  unrealistic_returns: '📈',
  pump_and_dump: '🚨',
  penny_stock: '💰',
  anonymous_source: '👤',
  sebi_compliance: '⚖️',
  manipulation_tactics: '🎭',
};

// ── Fallback example tips ──
const EXAMPLE_TIPS = [
  {
    label: '🚨 Pump & Dump (High Risk)',
    text: '🚀🚀 BUY XYZ PHARMA NOW!! Will give 10x returns in 2 weeks. Guaranteed profits!! My trusted source says big operators are accumulating. Target ₹500 from current ₹15. Don\'t miss this once in a lifetime opportunity! Act fast before it\'s too late! Join our WhatsApp group for more such multibagger tips!',
  },
  {
    label: '⚡ Social Media Hype (Medium Risk)',
    text: 'I\'ve been following TATAMOTORS for a while and I think the EV push will really pay off. My friend who works in auto sector says the new electric SUV launch could be a game changer. Might see good returns in 6-12 months. Entry around ₹850, target ₹1200.',
  },
  {
    label: '✅ Research-Based (Low Risk)',
    text: 'TCS reported strong Q3 results with 8.4% revenue growth YoY. Deal pipeline is healthy at $12.2B. Management guided for continued growth in FY26. Attractive at current PE of 28x for a large-cap IT bellwether.',
  },
];

export default function MisinfoShield() {
  const [tipText, setTipText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [examples, setExamples] = useState(EXAMPLE_TIPS);

  // Fetch examples from backend on mount
  useEffect(() => {
    axios.get('/api/check-tip/examples')
      .then(res => {
        if (res.data.examples?.length) setExamples(res.data.examples);
      })
      .catch(() => { /* use defaults */ });
  }, []);

  const analyzeTip = async () => {
    if (!tipText.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await axios.post('/api/check-tip', { tip_text: tipText });
      setResult(res.data);
    } catch {
      // Mock fallback
      const hasUrgency = /buy now|act fast|guaranteed|hurry|don't miss/i.test(tipText);
      const hasReturns = /\d{2,}[%x]|multibagger|10x|100x/i.test(tipText);
      const flags = [];
      if (hasUrgency) flags.push('urgency_language');
      if (hasReturns) flags.push('unrealistic_returns');
      if (tipText.length > 100 && flags.length > 0) flags.push('manipulation_tactics');

      const risk = flags.length >= 2 ? 'HIGH' : flags.length === 1 ? 'MEDIUM' : 'LOW';
      setResult({
        risk_level: risk,
        score: flags.length * 30,
        flags,
        flag_details: flags.map(f => ({ flag: f, label: `${FLAG_ICONS[f] || '⚠️'} ${f.replace(/_/g, ' ')}`, description: 'Pattern detected', severity: 'HIGH' })),
        verdict: risk === 'HIGH'
          ? '⚠️ HIGH RISK: This tip shows multiple manipulation indicators. Do NOT act on this tip.'
          : risk === 'MEDIUM'
            ? '⚡ CAUTION: Some concerning patterns detected. Verify independently.'
            : '✅ LOW RISK: No obvious red flags, but always do your own research.',
        recommendation: 'Consult a SEBI-registered advisor before acting on any stock tip.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (tip) => {
    setTipText(tip.text);
    setResult(null);
  };

  const style = result ? RISK_STYLES[result.risk_level] : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-4">
          <Shield size={14} className="text-indigo-400" />
          <span className="text-xs text-indigo-300 font-semibold tracking-wider uppercase">Misinformation Shield</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Analyze a Stock Tip</h2>
        <p className="text-sm text-slate-500 mt-1">
          Paste any stock tip you received — we'll check it for scam patterns
        </p>
      </div>

      {/* Input area */}
      <div className="glass-card">
        <textarea
          value={tipText}
          onChange={(e) => setTipText(e.target.value)}
          placeholder="E.g. 'Buy XYZ stock now!! Will 10x in 2 weeks. Guaranteed profits. Trusted source. Act fast before it's too late!'"
          className="w-full h-36 bg-[#0F0F14] border border-[#2A2A3A] rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50 transition"
        />
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-slate-500">{tipText.length} characters</span>
          <button onClick={analyzeTip} disabled={!tipText.trim() || loading} className="btn-primary flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Analyze Tip
          </button>
        </div>
      </div>

      {/* Example tips */}
      <div>
        <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">Try an example:</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button key={i} onClick={() => loadExample(ex)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#2A2A3A] bg-[#1A1A24] text-slate-400 hover:text-slate-200 hover:border-indigo-500/30 transition">
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className={`glass-card fade-in-up border ${style.border}`}>
          {/* Risk level badge */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {result.risk_level === 'HIGH' && <XCircle size={24} className="text-red-400" />}
              {result.risk_level === 'MEDIUM' && <AlertTriangle size={24} className="text-amber-400" />}
              {result.risk_level === 'LOW' && <CheckCircle size={24} className="text-emerald-400" />}
              <div>
                <span className={`text-xs font-bold uppercase tracking-widest ${style.text}`}>
                  {result.risk_level} RISK
                </span>
                <div className="w-32 h-1.5 bg-[#0F0F14] rounded-full mt-1.5 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${result.risk_level === 'HIGH' ? 'bg-red-500' : result.risk_level === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${result.score || 0}%` }} />
                </div>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-lg border text-xs font-bold ${style.badge}`}>
              Score: {result.score}/100
            </div>
          </div>

          {/* Detected flags */}
          {result.flag_details?.length > 0 && (
            <div className="space-y-2 mb-5">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Detected Red Flags</p>
              {result.flag_details.map((flag, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#0F0F14] border border-[#2A2A3A]">
                  <span className="text-lg">{FLAG_ICONS[flag.flag] || '⚠️'}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{flag.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{flag.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Verdict */}
          <div className={`p-4 rounded-xl ${style.bg} border ${style.border} mb-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Info size={14} className={style.text} />
              <p className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>AI Verdict</p>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{result.verdict}</p>
          </div>

          {/* Recommendation */}
          <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-indigo-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">What to do instead</p>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{result.recommendation}</p>
          </div>

          {/* SEBI link */}
          <div className="mt-4 text-center">
            <a href="https://scores.gov.in" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition">
              <ExternalLink size={12} />
              Find a SEBI-registered advisor →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
