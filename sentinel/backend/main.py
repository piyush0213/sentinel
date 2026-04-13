"""
SENTINEL — FastAPI Backend
AI-Powered Behavioral Finance Protection Layer for Retail Traders

All REST endpoints for the SENTINEL platform:
- Trade analysis with ML-powered pattern detection
- Real-time risk scoring
- Trade history with emotion tags
- Portfolio stress testing
- Misinformation tip checking
- Dashboard aggregate stats
"""

import os
import sys
from datetime import datetime, timedelta
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Add parent dir to path for imports ──
sys.path.insert(0, os.path.dirname(__file__))

from models.mock_data import generate_mock_trades, save_mock_data, SECTOR_MAP
from models.behavioral_model import predict_pattern, train_model
from services.risk_engine import RiskEngine
from services.stress_test import StressTestService
from services.misinformation import MisinfoShield

# ══════════════════════════════════════
# App initialization
# ══════════════════════════════════════

app = FastAPI(
    title="SENTINEL API",
    description="AI-Powered Behavioral Finance Protection Layer",
    version="1.0.0",
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service instances ──
risk_engine = RiskEngine()
stress_service = StressTestService()
misinfo_shield = MisinfoShield()

# ── In-memory data store (mock) ──
USERS = {}
TRADE_DATA = {}


def _init_mock_user():
    """Initialize the mock user 'Rahul Sharma' with generated trade data."""
    user_id = "user_001"
    USERS[user_id] = {
        "user_id": user_id,
        "name": "Rahul Sharma",
        "email": "rahul@example.com",
        "joined": "2024-06-15",
    }

    # Generate and cache mock trade data
    df = generate_mock_trades()
    trades = df.to_dict("records")

    # Convert timestamps to strings for JSON serialization
    for t in trades:
        if isinstance(t["timestamp"], pd.Timestamp):
            t["timestamp"] = t["timestamp"].isoformat()
        # Ensure boolean type
        t["followed_social_tip"] = bool(t["followed_social_tip"])

    TRADE_DATA[user_id] = trades
    print(f"✅ Loaded {len(trades)} trades for {USERS[user_id]['name']}")


# ══════════════════════════════════════
# Pydantic schemas
# ══════════════════════════════════════

class TradeAnalysisRequest(BaseModel):
    symbol: str
    quantity: int
    trade_type: str  # BUY or SELL
    current_portfolio_value: float
    recent_trades_count: int = 1
    last_loss_amount: float = 0
    last_loss_minutes_ago: Optional[float] = None
    position_size_inr: float = 0
    followed_social_tip: bool = False


class StressTestRequest(BaseModel):
    portfolio_value: float
    positions: List[dict] = []
    scenario: str


class TipCheckRequest(BaseModel):
    tip_text: str


# ══════════════════════════════════════
# Startup event
# ══════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """Initialize mock data and train ML model on startup."""
    print("\n🛡️  SENTINEL Backend Starting...")
    print("=" * 50)

    # Generate mock data
    _init_mock_user()

    # Train/load behavior model
    try:
        train_model(force_retrain=False)
        print("✅ Behavioral model loaded")
    except Exception as e:
        print(f"⚠️  Model training warning: {e}")
        # Force retrain on error
        train_model(force_retrain=True)
        print("✅ Behavioral model retrained")

    print("=" * 50)
    print("🚀 SENTINEL API ready on http://localhost:8000")
    print("📚 Docs: http://localhost:8000/docs\n")


# ══════════════════════════════════════
# Health check
# ══════════════════════════════════════

@app.get("/")
async def root():
    return {
        "name": "SENTINEL API",
        "version": "1.0.0",
        "status": "operational",
        "tagline": "Don't block trades. Give traders a mirror.",
    }


# ══════════════════════════════════════
# Trade Analysis
# ══════════════════════════════════════

@app.post("/api/analyze-trade")
async def analyze_trade(req: TradeAnalysisRequest):
    """
    Analyze a proposed trade for behavioral patterns.
    Returns ML prediction, risk score, and whether intervention is needed.
    """
    # Calculate position size vs average
    avg_position = req.current_portfolio_value * 0.05  # 5% of portfolio
    position_size_vs_avg = (
        req.position_size_inr / avg_position if avg_position > 0 else 1.0
    )

    # Prepare features for ML model
    trade_features = {
        "time_since_last_loss_minutes": req.last_loss_minutes_ago,
        "trades_in_last_30_min": req.recent_trades_count,
        "trade_hour": datetime.now().hour,
        "position_size_vs_avg": position_size_vs_avg,
        "followed_social_tip": req.followed_social_tip,
        "last_loss_amount": req.last_loss_amount,
    }

    # Get ML prediction
    prediction = predict_pattern(trade_features)

    # Get current risk score for user
    user_trades = TRADE_DATA.get("user_001", [])
    risk_data = risk_engine.calculate_live_risk_score(user_trades[-20:])

    # Combine ML risk with live risk
    combined_risk = min(
        100,
        int(prediction["risk_score"] * 0.6 + risk_data["score"] * 0.4)
    )

    return {
        "analysis": prediction,
        "live_risk_score": risk_data["score"],
        "combined_risk_score": combined_risk,
        "risk_label": risk_data["label"],
        "intervention_needed": combined_risk >= 60,
        "trade": {
            "symbol": req.symbol,
            "quantity": req.quantity,
            "trade_type": req.trade_type,
            "position_size_inr": req.position_size_inr,
        },
    }


# ══════════════════════════════════════
# Risk Score
# ══════════════════════════════════════

@app.get("/api/risk-score/{user_id}")
async def get_risk_score(user_id: str):
    """Get the current live risk score with breakdown and 7-day trend."""
    if user_id not in TRADE_DATA:
        raise HTTPException(status_code=404, detail="User not found")

    trades = TRADE_DATA[user_id]
    risk_data = risk_engine.calculate_live_risk_score(trades[-20:])
    trend = risk_engine.get_risk_trend(trades)

    return {
        "user_id": user_id,
        "risk_score": risk_data["score"],
        "label": risk_data["label"],
        "color": risk_data["color"],
        "breakdown": risk_data["breakdown"],
        "trend": trend,
    }


# ══════════════════════════════════════
# Trade History
# ══════════════════════════════════════

@app.get("/api/trade-history/{user_id}")
async def get_trade_history(user_id: str, limit: int = 50):
    """Get recent trades with behavioral tags and emotion labels."""
    if user_id not in TRADE_DATA:
        raise HTTPException(status_code=404, detail="User not found")

    trades = TRADE_DATA[user_id][-limit:]

    # Enrich with emotion tags
    enriched = []
    for trade in reversed(trades):  # Most recent first
        emotion_tag = risk_engine.get_emotion_tag(trade)
        enriched.append({
            **trade,
            "emotion_tag": emotion_tag,
        })

    return {
        "user_id": user_id,
        "total_trades": len(TRADE_DATA[user_id]),
        "trades": enriched,
    }


# ══════════════════════════════════════
# Behavioral Summary
# ══════════════════════════════════════

@app.get("/api/behavioral-summary/{user_id}")
async def get_behavioral_summary(user_id: str):
    """Get 30-day behavioral analytics summary."""
    if user_id not in TRADE_DATA:
        raise HTTPException(status_code=404, detail="User not found")

    trades = TRADE_DATA[user_id]
    summary = risk_engine.get_behavioral_summary(trades)

    return {
        "user_id": user_id,
        "summary": summary,
    }


# ══════════════════════════════════════
# Stress Test
# ══════════════════════════════════════

@app.post("/api/stress-test")
async def run_stress_test(req: StressTestRequest):
    """Run portfolio stress test under a specified scenario."""
    portfolio = {
        "portfolio_value": req.portfolio_value,
        "positions": req.positions,
    }

    if req.scenario == "all":
        results = stress_service.run_all_scenarios(portfolio)
        return {"scenario": "all", "results": results}

    result = stress_service.run_stress_test(portfolio, req.scenario)
    return result


@app.get("/api/stress-test/scenarios")
async def get_scenarios():
    """Get available stress test scenarios."""
    return {"scenarios": stress_service.get_available_scenarios()}


# ══════════════════════════════════════
# Misinformation Check
# ══════════════════════════════════════

@app.post("/api/check-tip")
async def check_tip(req: TipCheckRequest):
    """Analyze a stock tip for misinformation red flags."""
    result = misinfo_shield.analyze_tip(req.tip_text)
    return result


@app.get("/api/check-tip/examples")
async def get_tip_examples():
    """Get example tips for testing the misinformation shield."""
    return {"examples": misinfo_shield.get_example_tips()}


# ══════════════════════════════════════
# Dashboard Stats (aggregated)
# ══════════════════════════════════════

@app.get("/api/dashboard-stats/{user_id}")
async def get_dashboard_stats(user_id: str):
    """
    Get all stats needed for the dashboard in one call.
    Combines risk score, P&L, trade counts, and behavioral data.
    """
    if user_id not in TRADE_DATA:
        raise HTTPException(status_code=404, detail="User not found")

    trades = TRADE_DATA[user_id]
    df = pd.DataFrame(trades)
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    now = df["timestamp"].max()
    today_start = now.replace(hour=0, minute=0, second=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0)

    # Today's trades
    today_df = df[df["timestamp"] >= today_start]
    today_emotional = today_df[today_df["behavioral_pattern"] != "normal"]

    # This month's trades
    month_df = df[df["timestamp"] >= month_start]
    month_emotional = month_df[month_df["behavioral_pattern"] != "normal"]
    month_emotional_losses = month_emotional[month_emotional["outcome"] == "LOSS"]

    # Risk score and trend
    risk_data = risk_engine.calculate_live_risk_score(trades[-20:])
    trend = risk_engine.get_risk_trend(trades)

    # Behavioral summary
    summary = risk_engine.get_behavioral_summary(trades)

    # Recent trades with emotion tags (last 10)
    recent_trades = []
    for trade in reversed(trades[-10:]):
        emotion_tag = risk_engine.get_emotion_tag(trade)
        recent_trades.append({**trade, "emotion_tag": emotion_tag})

    return {
        "user": USERS.get(user_id, {}),
        "risk_score": risk_data["score"],
        "risk_label": risk_data["label"],
        "risk_color": risk_data["color"],
        "risk_breakdown": risk_data["breakdown"],
        "risk_trend": trend,
        "total_trades_today": len(today_df),
        "emotional_trades_today": len(today_emotional),
        "pnl_today": round(today_df["pnl"].sum(), 2) if len(today_df) > 0 else 0,
        "pnl_this_month": round(month_df["pnl"].sum(), 2) if len(month_df) > 0 else 0,
        "emotional_loss_this_month": round(
            abs(month_emotional_losses["pnl"].sum()), 2
        ) if len(month_emotional_losses) > 0 else 0,
        "worst_pattern": summary["worst_pattern"],
        "behavioral_summary": summary,
        "recent_trades": recent_trades,
    }


# ══════════════════════════════════════
# Run server
# ══════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
