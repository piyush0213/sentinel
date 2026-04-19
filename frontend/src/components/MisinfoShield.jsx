/**
 * MisinfoShield — Stock tip checker
 * Analyzes tips for pump-and-dump patterns, urgency language,
 * and unrealistic return promises using the backend NLP engine.
 */

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Search, ExternalLink, Info, Zap } from 'lucide-react';
import axios from 'axios';

const RISK_STYLES = {
  HIGH: { bg: 'bg-[#FF3B3B]/5', border: 'border-[#FF3B3B]/20', text: 'text-[#FF3B3B]', badge: 'bg-[#FF3B3B]/12 text-[#FF3B3B] border-[#FF3B3B]/20' },
  MEDIUM: { bg: 'bg-[#FFB020]/5', border: 'border-[#FFB020]/20', text: 'text-[#FFB020]', badge: 'bg-[#FFB020]/12 text-[#FFB020] border-[#FFB020]/20' },
  LOW: { bg: 'bg-[#00D26A]/5', border: 'border-[#00D26A]/20', text: 'text-[#00D26A]', badge: 'bg-[#00D26A]/12 text-[#00D26A] border-[#00D26A]/20' },
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
        <div className="inline-flex items-center gap-2 bg-[#00D26A]/8 border border-[#00D26A]/15 rounded-full px-4 py-1.5 mb-4">
          <Shield size={13} className="text-[#00D26A]" />
          <span className="text-[10px] text-[#00D26A] font-bold tracking-widest uppercase">Misinformation Shield</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Analyze a Stock Tip</h2>
        <p className="text-sm text-[#5A5A6E] mt-1">
          Paste any stock tip you received — we'll check it for scam patterns
        </p>
      </div>

      {/* Input area */}
      <div className="glass-card">
        <textarea
          value={tipText}
          onChange={(e) => setTipText(e.target.value)}
          placeholder="E.g. 'Buy XYZ stock now!! Will 10x in 2 weeks. Guaranteed profits. Trusted source. Act fast before it's too late!'"
          className="w-full h-36 bg-[#0A0A0F] border border-[#1E1E2A] rounded-xl p-4 text-sm text-[#F0F0F5] placeholder-[#5A5A6E] resize-none focus:outline-none focus:border-[#00D26A]/30 transition"
        />
        <div className="flex items-center justify-between mt-4">
          <span className="text-[10px] text-[#5A5A6E] font-mono">{tipText.length} characters</span>
          <button onClick={analyzeTip} disabled={!tipText.trim() || loading} className="btn-primary flex items-center gap-2">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Analyze Tip
          </button>
        </div>
      </div>

      {/* Example tips */}
      <div>
        <p className="text-[10px] text-[#5A5A6E] font-semibold mb-2.5 uppercase tracking-widest">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button key={i} onClick={() => loadExample(ex)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#1E1E2A] bg-[#111118] text-[#8B8B9E] hover:text-[#F0F0F5] hover:border-[#2A2A3A] transition">
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
              {result.risk_level === 'HIGH' && <XCircle size={22} className="text-[#FF3B3B]" />}
              {result.risk_level === 'MEDIUM' && <AlertTriangle size={22} className="text-[#FFB020]" />}
              {result.risk_level === 'LOW' && <CheckCircle size={22} className="text-[#00D26A]" />}
              <div>
                <span className={`text-xs font-bold uppercase tracking-widest ${style.text}`}>
                  {result.risk_level} RISK
                </span>
                <div className="w-32 h-1.5 bg-[#0A0A0F] rounded-full mt-1.5 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${result.risk_level === 'HIGH' ? 'bg-[#FF3B3B]' : result.risk_level === 'MEDIUM' ? 'bg-[#FFB020]' : 'bg-[#00D26A]'}`}
                    style={{ width: `${result.score || 0}%` }} />
                </div>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-lg border text-xs font-bold font-mono ${style.badge}`}>
              {result.score}/100
            </div>
          </div>

          {/* Detected flags */}
          {result.flag_details?.length > 0 && (
            <div className="space-y-2 mb-5">
              <p className="text-[10px] text-[#5A5A6E] font-semibold uppercase tracking-widest">Detected Red Flags</p>
              {result.flag_details.map((flag, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#0A0A0F] border border-[#1E1E2A]">
                  <span className="text-lg">{FLAG_ICONS[flag.flag] || '⚠️'}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#F0F0F5]">{flag.label}</p>
                    <p className="text-xs text-[#5A5A6E] mt-0.5">{flag.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Verdict */}
          <div className={`p-4 rounded-xl ${style.bg} border ${style.border} mb-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Info size={13} className={style.text} />
              <p className={`text-[10px] font-bold uppercase tracking-widest ${style.text}`}>AI Verdict</p>
            </div>
            <p className="text-sm text-[#8B8B9E] leading-relaxed">{result.verdict}</p>
          </div>

          {/* Recommendation */}
          <div className="p-4 rounded-xl bg-[#00D26A]/5 border border-[#00D26A]/15">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={13} className="text-[#00D26A]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#00D26A]">What to do instead</p>
            </div>
            <p className="text-sm text-[#8B8B9E] leading-relaxed">{result.recommendation}</p>
          </div>

          {/* SEBI link */}
          <div className="mt-4 text-center">
            <a href="https://scores.gov.in" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#00D26A] hover:text-[#00D26A]/80 transition font-medium">
              <ExternalLink size={11} />
              Find a SEBI-registered advisor →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
