/**
 * RiskGauge — Animated semicircular SVG gauge
 * Shows risk score 0-100 with color transitions,
 * animated needle, and pulsing danger state.
 */

import { useState, useEffect, useContext } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, ShieldAlert, Skull } from 'lucide-react';
import { AppContext } from '../App';

export default function RiskGauge({ score: propScore, size = 280 }) {
  const ctx = useContext(AppContext);
  const targetScore = propScore ?? ctx?.riskScore ?? 0;
  const [animatedScore, setAnimatedScore] = useState(0);
  const [prevScore, setPrevScore] = useState(0);

  // Animate score changes smoothly
  useEffect(() => {
    const duration = 1200;
    const startTime = Date.now();
    const startVal = prevScore;
    const endVal = targetScore;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setAnimatedScore(current);
      if (progress < 1) requestAnimationFrame(animate);
      else setPrevScore(endVal);
    };

    requestAnimationFrame(animate);
  }, [targetScore]);

  // Gauge geometry
  const cx = size / 2;
  const cy = size / 2 + 10;
  const radius = size / 2 - 30;
  const strokeWidth = 18;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const scoreAngle = startAngle + (animatedScore / 100) * (endAngle - startAngle);

  // Arc path helper
  const describeArc = (startA, endA) => {
    const x1 = cx + radius * Math.cos(startA);
    const y1 = cy + radius * Math.sin(startA);
    const x2 = cx + radius * Math.cos(endA);
    const y2 = cy + radius * Math.sin(endA);
    const largeArc = endA - startA > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Needle position
  const needleLength = radius - 15;
  const needleX = cx + needleLength * Math.cos(scoreAngle);
  const needleY = cy + needleLength * Math.sin(scoreAngle);

  // Color based on score — Shoonya palette
  const getColor = (s) => {
    if (s < 30) return '#00D26A';
    if (s < 60) return '#FFB020';
    if (s < 80) return '#FF3B3B';
    return '#DC2020';
  };

  const color = getColor(animatedScore);
  const isDanger = animatedScore >= 75;

  // Label
  const getLabel = (s) => {
    if (s < 30) return { text: 'SAFE', icon: ShieldCheck };
    if (s < 60) return { text: 'CAUTION', icon: AlertTriangle };
    if (s < 80) return { text: 'HIGH RISK', icon: ShieldAlert };
    return { text: 'DANGER', icon: Skull };
  };
  const labelInfo = getLabel(animatedScore);
  const LabelIcon = labelInfo.icon;

  // Trend data
  const trend = ctx?.dashboardData?.risk_trend;
  const trendDelta = trend && trend.length >= 2
    ? trend[trend.length - 1].score - trend[trend.length - 2].score
    : 0;

  // Tick marks
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className={`flex flex-col items-center ${isDanger ? 'danger-pulse' : ''}`}
      style={{ borderRadius: '20px', padding: isDanger ? '4px' : '0' }}>
      <svg width={size} height={size / 2 + 50} viewBox={`0 0 ${size} ${size / 2 + 50}`}>
        {/* Background arc */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke="#151520"
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
        />

        {/* Gradient segments */}
        {/* Green zone (0-30) */}
        <path
          d={describeArc(startAngle, startAngle + 0.3 * Math.PI)}
          fill="none"
          stroke="#00D26A"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.15}
        />
        {/* Amber zone (30-60) */}
        <path
          d={describeArc(startAngle + 0.3 * Math.PI, startAngle + 0.6 * Math.PI)}
          fill="none"
          stroke="#FFB020"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.15}
        />
        {/* Red zone (60-100) */}
        <path
          d={describeArc(startAngle + 0.6 * Math.PI, endAngle)}
          fill="none"
          stroke="#FF3B3B"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.15}
        />

        {/* Active arc */}
        <path
          d={describeArc(startAngle, scoreAngle)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 10px ${color}50)`,
            transition: 'stroke 0.5s ease',
          }}
        />

        {/* Tick marks */}
        {ticks.map(tick => {
          const angle = startAngle + (tick / 100) * Math.PI;
          const innerR = radius - strokeWidth / 2 - 6;
          const outerR = radius - strokeWidth / 2 - 14;
          const x1 = cx + innerR * Math.cos(angle);
          const y1 = cy + innerR * Math.sin(angle);
          const x2 = cx + outerR * Math.cos(angle);
          const y2 = cy + outerR * Math.sin(angle);
          const labelR = radius + 16;
          const lx = cx + labelR * Math.cos(angle);
          const ly = cy + labelR * Math.sin(angle);
          return (
            <g key={tick}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2A2A3A" strokeWidth={2} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fill="#5A5A6E" fontSize="10" fontWeight="600" fontFamily="'JetBrains Mono', monospace">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Needle */}
        <line
          x1={cx} y1={cy} x2={needleX} y2={needleY}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          style={{ transition: 'all 0.3s ease', filter: `drop-shadow(0 0 6px ${color}60)` }}
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={8} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color}60)` }} />
        <circle cx={cx} cy={cy} r={4} fill="#0A0A0F" />
      </svg>

      {/* Score display */}
      <div className="flex flex-col items-center -mt-4">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-black tracking-tight font-mono" style={{ color }}>
            {animatedScore}
          </span>
          <span className="text-lg font-semibold text-[#5A5A6E]">/100</span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <LabelIcon size={16} style={{ color }} />
          <span className="text-sm font-bold tracking-widest" style={{ color }}>
            {labelInfo.text}
          </span>
        </div>

        {/* Trend indicator */}
        {trendDelta !== 0 && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendDelta > 0 ? 'text-[#FF3B3B]' : 'text-[#00D26A]'}`}>
            {trendDelta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trendDelta > 0 ? '+' : ''}{Math.round(trendDelta)} from yesterday
          </div>
        )}
      </div>
    </div>
  );
}
