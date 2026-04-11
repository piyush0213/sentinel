"""
SENTINEL — Misinformation Shield
NLP-powered tip checker that detects pump-and-dump patterns,
urgency language, and unrealistic return promises.
"""

import re
from typing import Dict, List


# ── Urgency language patterns ──
URGENCY_KEYWORDS = [
    "buy now", "act fast", "limited time", "hurry", "don't miss",
    "last chance", "urgent", "today only", "before it's too late",
    "breaking news", "insider info", "guaranteed", "100%",
    "risk free", "risk-free", "sure shot", "pakka", "confirm",
    "tomorrow it will", "double your money",
]

# ── Unrealistic return indicators ──
RETURN_PATTERNS = [
    r"(\d{2,4})\s*[%x]",  # e.g., "500%", "10x"
    r"(\d+)\s*times",       # e.g., "10 times return"
    r"multibagger",
    r"rocket",
    r"moon\b",
    r"to the moon",
    r"jackpot",
]

# ── Pump-and-dump red flags ──
PUMP_DUMP_SIGNALS = [
    "whatsapp group", "telegram", "secret tip", "trusted source",
    "operator", "big players", "bulk buying", "accumulation",
    "target ₹", "target rs", "target price", "stop loss",
    "entry point", "book profit", "sl hit", "hold",
]

# ── Penny stock indicators ──
PENNY_STOCK_PATTERNS = [
    r"below\s*₹?\s*\d{1,2}\b",  # Price below ₹99
    r"sme\s+stock", "micro cap", "penny stock", "small cap gem",
    r"₹\s*\d{1,2}\s+stock",  # ₹XX stock
]

# ── Known suspicious patterns ──
ANONYMOUS_SOURCE_INDICATORS = [
    "source", "insider", "someone told me", "i heard",
    "my friend", "reliable source", "trust me",
    "confidential", "don't share",
]

# ── SEBI warnings ──
SEBI_RED_FLAGS = [
    "sebi registered", "not sebi", "unregistered",
    "no risk", "fixed return", "daily income",
    "monthly income guarantee",
]


class MisinfoShield:
    """
    Misinformation detection engine for stock tips.
    Uses keyword matching and heuristic NLP to identify
    pump-and-dump schemes, urgency manipulation, and
    unrealistic return promises.
    """

    def analyze_tip(self, tip_text: str) -> dict:
        """
        Analyze a stock tip for misinformation red flags.

        Args:
            tip_text: The stock tip text to analyze

        Returns:
            dict with risk_level, flags, verdict, and recommendation
        """
        if not tip_text or not tip_text.strip():
            return {
                "risk_level": "LOW",
                "flags": [],
                "flag_details": [],
                "verdict": "No text provided to analyze.",
                "recommendation": "Please paste a tip to analyze.",
                "score": 0,
            }

        text_lower = tip_text.lower().strip()
        flags = []
        flag_details = []
        score = 0

        # ── Check urgency language ──
        urgency_found = []
        for keyword in URGENCY_KEYWORDS:
            if keyword in text_lower:
                urgency_found.append(keyword)
        if urgency_found:
            flags.append("urgency_language")
            flag_details.append({
                "flag": "urgency_language",
                "label": "⏰ Urgency Language Detected",
                "description": f"Found pressure words: {', '.join(urgency_found[:3])}",
                "severity": "HIGH",
            })
            score += 25

        # ── Check unrealistic returns ──
        return_matches = []
        for pattern in RETURN_PATTERNS:
            matches = re.findall(pattern, text_lower)
            if matches:
                return_matches.extend(matches)
        if return_matches or "multibagger" in text_lower:
            flags.append("unrealistic_returns")
            flag_details.append({
                "flag": "unrealistic_returns",
                "label": "📈 Unrealistic Return Promises",
                "description": "Promises of extraordinary returns are a classic red flag",
                "severity": "HIGH",
            })
            score += 30

        # ── Check pump-and-dump signals ──
        pump_found = []
        for signal in PUMP_DUMP_SIGNALS:
            if signal in text_lower:
                pump_found.append(signal)
        if len(pump_found) >= 2:
            flags.append("pump_and_dump")
            flag_details.append({
                "flag": "pump_and_dump",
                "label": "🚨 Pump & Dump Indicators",
                "description": f"Multiple pump-and-dump signals: {', '.join(pump_found[:3])}",
                "severity": "CRITICAL",
            })
            score += 35
        elif len(pump_found) == 1:
            score += 10

        # ── Check penny stock mentions ──
        for pattern in PENNY_STOCK_PATTERNS:
            if re.search(pattern, text_lower):
                flags.append("penny_stock")
                flag_details.append({
                    "flag": "penny_stock",
                    "label": "💰 Penny/Micro-Cap Stock",
                    "description": "Tips about very low-priced stocks carry extreme risk",
                    "severity": "HIGH",
                })
                score += 20
                break

        # ── Check anonymous sources ──
        anon_found = []
        for indicator in ANONYMOUS_SOURCE_INDICATORS:
            if indicator in text_lower:
                anon_found.append(indicator)
        if anon_found:
            flags.append("anonymous_source")
            flag_details.append({
                "flag": "anonymous_source",
                "label": "👤 Anonymous/Unverified Source",
                "description": "Tip comes from an unidentifiable or unverifiable source",
                "severity": "MEDIUM",
            })
            score += 15

        # ── Check SEBI compliance issues ──
        for flag_text in SEBI_RED_FLAGS:
            if flag_text in text_lower:
                flags.append("sebi_compliance")
                flag_details.append({
                    "flag": "sebi_compliance",
                    "label": "⚖️ SEBI Compliance Issue",
                    "description": "May involve unregistered advisory or guaranteed returns (illegal under SEBI regulations)",
                    "severity": "CRITICAL",
                })
                score += 25
                break

        # ── Check excessive punctuation (manipulation tactic) ──
        exclamations = text_lower.count("!")
        caps_ratio = sum(1 for c in tip_text if c.isupper()) / max(len(tip_text), 1)
        if exclamations > 3 or caps_ratio > 0.5:
            flags.append("manipulation_tactics")
            flag_details.append({
                "flag": "manipulation_tactics",
                "label": "🎭 Manipulation Tactics",
                "description": "Excessive capitalization or exclamation marks used to create urgency",
                "severity": "MEDIUM",
            })
            score += 10

        # ── Determine risk level ──
        score = min(100, score)
        if score >= 60:
            risk_level = "HIGH"
        elif score >= 30:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # ── Generate verdict ──
        verdict = self._generate_verdict(risk_level, flags, score)
        recommendation = self._generate_recommendation(risk_level, flags)

        return {
            "risk_level": risk_level,
            "score": score,
            "flags": flags,
            "flag_details": flag_details,
            "verdict": verdict,
            "recommendation": recommendation,
        }

    def _generate_verdict(
        self, risk_level: str, flags: list, score: int
    ) -> str:
        """Generate a human-readable verdict based on analysis."""
        if risk_level == "HIGH":
            flag_count = len(flags)
            verdict = (
                f"⚠️ HIGH RISK: This tip shows {flag_count} classic "
                f"manipulation indicator{'s' if flag_count > 1 else ''}. "
            )
            if "pump_and_dump" in flags:
                verdict += (
                    "It exhibits pump-and-dump characteristics where promoters "
                    "inflate stock prices through misleading tips, then sell at "
                    "the peak, leaving retail investors with losses. "
                )
            if "unrealistic_returns" in flags:
                verdict += (
                    "The promised returns are unrealistic — legitimate investments "
                    "rarely guarantee specific returns. "
                )
            if "urgency_language" in flags:
                verdict += (
                    "The urgency language is designed to prevent you from "
                    "doing due diligence. "
                )
            verdict += "Do NOT act on this tip."
            return verdict

        elif risk_level == "MEDIUM":
            return (
                "⚡ CAUTION: This tip has some concerning elements. While not "
                "definitively fraudulent, it shows patterns commonly associated "
                "with unreliable stock tips. Verify the information independently "
                "before making any trading decisions."
            )
        else:
            return (
                "✅ LOW RISK: This tip doesn't show obvious red flags, but "
                "always do your own research (DYOR). No tip should be the sole "
                "basis for a trading decision."
            )

    def _generate_recommendation(
        self, risk_level: str, flags: list
    ) -> str:
        """Generate actionable recommendations."""
        if risk_level == "HIGH":
            return (
                "🛡️ Do NOT act on this tip. Block the source. Report to SEBI "
                "if you believe this is an organized pump-and-dump scheme "
                "(SEBI SCORES portal: scores.gov.in). Consult a SEBI-registered "
                "investment advisor for genuine stock advice."
            )
        elif risk_level == "MEDIUM":
            return (
                "🔍 Verify this tip independently: Check the stock's fundamentals "
                "on NSE/BSE websites, read the latest quarterly results, and "
                "consult a SEBI-registered advisor before investing. Never invest "
                "more than 2-5% of your portfolio in a single tip-based trade."
            )
        else:
            return (
                "✅ While this tip appears relatively safe, always: 1) Do your own "
                "research, 2) Check fundamentals on NSE/BSE, 3) Set a stop loss, "
                "4) Never invest money you can't afford to lose. Consider consulting "
                "a SEBI-registered advisor."
            )

    def get_example_tips(self) -> list:
        """Return example tips for demo/testing."""
        return [
            {
                "label": "Pump & Dump (High Risk)",
                "text": (
                    "🚀🚀 BUY XYZ PHARMA NOW!! Will give 10x returns in 2 weeks. "
                    "Guaranteed profits!! My trusted source says big operators are "
                    "accumulating. Target ₹500 from current ₹15. Don't miss this "
                    "once in a lifetime opportunity! Act fast before it's too late! "
                    "Join our WhatsApp group for more such multibagger tips!"
                ),
            },
            {
                "label": "Social Media Hype (Medium Risk)",
                "text": (
                    "I've been following TATAMOTORS for a while and I think the EV "
                    "push will really pay off. My friend who works in auto sector says "
                    "the new electric SUV launch could be a game changer. Might see "
                    "good returns in 6-12 months. Entry around ₹850, target ₹1200."
                ),
            },
            {
                "label": "Research-Based (Low Risk)",
                "text": (
                    "TCS reported strong Q3 results with 8.4% revenue growth YoY. "
                    "Deal pipeline is healthy at $12.2B. Management guided for "
                    "continued growth in FY26. Attractive at current PE of 28x "
                    "for a large-cap IT bellwether."
                ),
            },
        ]
