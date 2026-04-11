"""
SENTINEL — Behavioral Risk Engine
Calculates real-time risk scores and emotion tags for trades.
Combines multiple behavioral signals into a single actionable risk score.
"""

from datetime import datetime, timedelta
from typing import List, Optional
import pandas as pd

from models.mock_data import generate_mock_trades


# ── Emotion tag color mapping ──
EMOTION_COLORS = {
    "normal": {"label": "Normal", "color": "#10B981", "severity": 0},
    "revenge_trade": {"label": "Revenge Trade", "color": "#EF4444", "severity": 5},
    "fomo_trade": {"label": "FOMO", "color": "#F59E0B", "severity": 3},
    "overtrading": {"label": "Overtrading", "color": "#EF4444", "severity": 4},
    "late_night_trade": {"label": "Late Night", "color": "#FBBF24", "severity": 2},
    "panic_sell": {"label": "Panic Sell", "color": "#EF4444", "severity": 5},
    "herd_trade": {"label": "Tip-Based", "color": "#F59E0B", "severity": 3},
}


class RiskEngine:
    """
    Real-time behavioral risk scoring engine.

    Combines 5 weighted signals to produce a composite risk score (0-100):
    - Recency of losses (30%)
    - Trade frequency (25%)
    - Position sizing (25%)
    - Time of day (10%)
    - Social tip following (10%)
    """

    # Weight distribution for risk score components
    WEIGHTS = {
        "loss_recency": 0.30,
        "trade_frequency": 0.25,
        "position_sizing": 0.25,
        "time_of_day": 0.10,
        "social_tips": 0.10,
    }

    def calculate_live_risk_score(self, user_trades: list) -> dict:
        """
        Calculate the current live risk score for a user based on
        their recent trading behavior.

        Args:
            user_trades: list of trade dicts (most recent first)

        Returns:
            dict with score (0-100), breakdown by component, and label
        """
        if not user_trades:
            return {
                "score": 0,
                "label": "SAFE",
                "breakdown": {},
                "color": "#10B981"
            }

        df = pd.DataFrame(user_trades)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        now = df["timestamp"].max()

        # ── 1. Loss recency score (0-100) ──
        recent_losses = df[
            (df["outcome"] == "LOSS") &
            (df["timestamp"] > now - timedelta(hours=1))
        ]
        loss_recency_score = min(100, len(recent_losses) * 25)

        # Scale by loss magnitude
        if len(recent_losses) > 0:
            total_recent_loss = abs(recent_losses["pnl"].sum())
            if total_recent_loss > 10000:
                loss_recency_score = min(100, loss_recency_score + 20)

        # ── 2. Trade frequency score (0-100) ──
        recent_30min = df[df["timestamp"] > now - timedelta(minutes=30)]
        freq_count = len(recent_30min)
        trade_frequency_score = min(100, freq_count * 15)

        # ── 3. Position sizing score (0-100) ──
        if "position_size_vs_avg" in df.columns:
            latest_size = df.iloc[-1].get("position_size_vs_avg", 1.0)
            sizing_score = min(100, max(0, (latest_size - 1.0) * 50))
        else:
            sizing_score = 0

        # ── 4. Time of day score (0-100) ──
        current_hour = now.hour
        if current_hour >= 22 or current_hour < 6:
            time_score = 80
        elif current_hour < 9 or current_hour > 16:
            time_score = 40
        else:
            time_score = 0

        # ── 5. Social tip score (0-100) ──
        recent_tips = df[
            (df["followed_social_tip"] == True) &
            (df["timestamp"] > now - timedelta(days=1))
        ]
        tip_score = min(100, len(recent_tips) * 35)

        # ── Composite risk score ──
        breakdown = {
            "loss_recency": round(loss_recency_score, 1),
            "trade_frequency": round(trade_frequency_score, 1),
            "position_sizing": round(sizing_score, 1),
            "time_of_day": round(time_score, 1),
            "social_tips": round(tip_score, 1),
        }

        composite = sum(
            breakdown[k] * self.WEIGHTS[k] for k in self.WEIGHTS
        )
        score = min(100, max(0, int(composite)))

        # Determine label and color
        if score < 30:
            label, color = "SAFE", "#10B981"
        elif score < 60:
            label, color = "CAUTION", "#F59E0B"
        elif score < 80:
            label, color = "HIGH RISK", "#EF4444"
        else:
            label, color = "DANGER", "#DC2626"

        return {
            "score": score,
            "label": label,
            "color": color,
            "breakdown": breakdown,
        }

    def get_emotion_tag(self, trade: dict) -> dict:
        """
        Return a color-coded emotion tag for a single trade.

        Args:
            trade: dict with a 'behavioral_pattern' key

        Returns:
            dict with label, color, and severity
        """
        pattern = trade.get("behavioral_pattern", "normal")
        tag = EMOTION_COLORS.get(pattern, EMOTION_COLORS["normal"])
        return {
            "pattern": pattern,
            "label": tag["label"],
            "color": tag["color"],
            "severity": tag["severity"],
        }

    def get_behavioral_summary(self, user_trades: list) -> dict:
        """
        Generate a 30-day behavioral analytics summary.

        Returns stats like total emotional trades, losses from emotions,
        worst pattern, best/worst trading times, and recoverable losses.
        """
        if not user_trades:
            return self._empty_summary()

        df = pd.DataFrame(user_trades)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        now = df["timestamp"].max()
        thirty_days_ago = now - timedelta(days=30)

        # Filter to last 30 days
        recent = df[df["timestamp"] > thirty_days_ago].copy()

        if len(recent) == 0:
            return self._empty_summary()

        # Emotional trades (non-normal)
        emotional = recent[recent["behavioral_pattern"] != "normal"]

        # Total emotional trade losses
        emotional_losses = emotional[emotional["outcome"] == "LOSS"]
        emotional_loss_total = abs(emotional_losses["pnl"].sum()) if len(emotional_losses) > 0 else 0

        # Worst pattern (most frequent emotional pattern)
        if len(emotional) > 0:
            worst_pattern = emotional["behavioral_pattern"].value_counts().index[0]
            worst_count = emotional["behavioral_pattern"].value_counts().values[0]
        else:
            worst_pattern = "none"
            worst_count = 0

        # Best and worst day of week
        recent["day_of_week"] = recent["timestamp"].dt.day_name()
        daily_pnl = recent.groupby("day_of_week")["pnl"].sum()
        best_day = daily_pnl.idxmax() if len(daily_pnl) > 0 else "N/A"
        worst_day = daily_pnl.idxmin() if len(daily_pnl) > 0 else "N/A"

        # Best and worst hour
        recent["hour"] = recent["timestamp"].dt.hour
        hourly_pnl = recent.groupby("hour")["pnl"].sum()
        best_hour = int(hourly_pnl.idxmax()) if len(hourly_pnl) > 0 else 0
        worst_hour = int(hourly_pnl.idxmin()) if len(hourly_pnl) > 0 else 0

        # Win rate comparison
        normal_trades = recent[recent["behavioral_pattern"] == "normal"]
        normal_wins = len(normal_trades[normal_trades["outcome"] == "WIN"])
        normal_win_rate = (normal_wins / len(normal_trades) * 100) if len(normal_trades) > 0 else 0

        emotional_wins = len(emotional[emotional["outcome"] == "WIN"])
        emotional_win_rate = (emotional_wins / len(emotional) * 100) if len(emotional) > 0 else 0

        return {
            "period_days": 30,
            "total_trades": len(recent),
            "total_emotional_trades": len(emotional),
            "emotional_trade_percentage": round(
                len(emotional) / len(recent) * 100, 1
            ) if len(recent) > 0 else 0,
            "emotional_trade_loss": round(emotional_loss_total, 2),
            "worst_pattern": worst_pattern,
            "worst_pattern_count": int(worst_count),
            "best_day_of_week": best_day,
            "worst_day_of_week": worst_day,
            "best_hour_of_day": best_hour,
            "worst_hour_of_day": worst_hour,
            "normal_win_rate": round(normal_win_rate, 1),
            "emotional_win_rate": round(emotional_win_rate, 1),
            "estimated_recoverable_losses": round(emotional_loss_total * 0.7, 2),
            "total_pnl": round(recent["pnl"].sum(), 2),
        }

    def get_risk_trend(self, user_trades: list, days: int = 7) -> list:
        """
        Calculate risk score trend over the past N days.

        Returns a list of {date, score} objects.
        """
        if not user_trades:
            return []

        df = pd.DataFrame(user_trades)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        now = df["timestamp"].max()

        trend = []
        for i in range(days, -1, -1):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0)
            day_end = day.replace(hour=23, minute=59, second=59)

            day_trades = df[
                (df["timestamp"] >= day_start) &
                (df["timestamp"] <= day_end)
            ]

            if len(day_trades) > 0:
                score_data = self.calculate_live_risk_score(
                    day_trades.to_dict("records")
                )
                score = score_data["score"]
            else:
                score = 15  # Base safe score for no-trade days

            trend.append({
                "date": day.strftime("%Y-%m-%d"),
                "score": score,
            })

        return trend

    def _empty_summary(self) -> dict:
        """Return an empty behavioral summary."""
        return {
            "period_days": 30,
            "total_trades": 0,
            "total_emotional_trades": 0,
            "emotional_trade_percentage": 0,
            "emotional_trade_loss": 0,
            "worst_pattern": "none",
            "worst_pattern_count": 0,
            "best_day_of_week": "N/A",
            "worst_day_of_week": "N/A",
            "best_hour_of_day": 0,
            "worst_hour_of_day": 0,
            "normal_win_rate": 0,
            "emotional_win_rate": 0,
            "estimated_recoverable_losses": 0,
            "total_pnl": 0,
        }
