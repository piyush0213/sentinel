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
- Live brokerage integration via Shoonya API
"""

import os
import sys

# Force UTF-8 encoding for standard output/error to prevent crash on Windows console with emojis
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

import logging
from datetime import datetime, timedelta
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Add parent dir to path for imports ──
sys.path.insert(0, os.path.dirname(__file__))

# Load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from models.mock_data import generate_mock_trades, save_mock_data, SECTOR_MAP
from models.behavioral_model import predict_pattern, train_model
from services.risk_engine import RiskEngine
from services.stress_test import StressTestService
from services.misinformation import MisinfoShield
from services.data_provider import DataProvider

# ── Logging ──
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel")

# ══════════════════════════════════════
# App initialization
# ══════════════════════════════════════

app = FastAPI(
    title="SENTINEL API",
    description="AI-Powered Behavioral Finance Protection Layer",
    version="2.0.0",
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
data_provider = DataProvider()

# ── Legacy in-memory stores (kept for backward compat) ──
USERS = {}
TRADE_DATA = {}


def _init_data():
    """
    Initialize the data provider.
    Tries Shoonya API first, falls back to mock data.
    Also populates legacy USERS/TRADE_DATA stores for backward compat.
    """
    mode = data_provider.initialize()

    # Populate legacy stores so existing endpoints keep working
    user_id = "user_001"
    user = data_provider.get_user(user_id)
    USERS[user_id] = user
    TRADE_DATA[user_id] = data_provider.get_trades(user_id)

    logger.info(f"Data source: {mode.upper()}")
    logger.info(f"Loaded {len(TRADE_DATA[user_id])} trades for {user['name']}")


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
    """Initialize data provider and train ML model on startup."""
    logger.info("SENTINEL Backend Starting...")
    logger.info("=" * 50)

    # Initialize data provider (Shoonya → mock fallback)
    _init_data()

    # Train/load behavior model
    try:
        train_model(force_retrain=False)
        logger.info("Behavioral model loaded")
    except Exception as e:
        logger.warning(f"Model training warning: {e}")
        # Force retrain on error
        train_model(force_retrain=True)
        logger.info("Behavioral model retrained")

    logger.info("=" * 50)
    mode_icon = "LIVE" if data_provider.is_live else "MOCK"
    logger.info(f"SENTINEL API ready on http://localhost:8000  [{mode_icon}]")
    logger.info("Docs: http://localhost:8000/docs")


# ══════════════════════════════════════
# Health check
# ══════════════════════════════════════

@app.get("/")
async def root():
    return {
        "name": "SENTINEL API",
        "version": "2.0.0",
        "status": "operational",
        "data_source": data_provider.mode,
        "live_connected": data_provider.is_live,
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
# Data Source Status
# ══════════════════════════════════════

@app.get("/api/data-status")
async def get_data_status():
    """Get current data source status (Shoonya live vs mock)."""
    return data_provider.get_status()


# ══════════════════════════════════════
# Positions & Holdings (Shoonya-powered)
# ══════════════════════════════════════

@app.get("/api/positions/{user_id}")
async def get_positions(user_id: str):
    """Get open positions — live from Shoonya or mock."""
    positions = data_provider.get_positions(user_id)
    total_pnl = sum(p.get("pnl", 0) for p in positions)
    return {
        "user_id": user_id,
        "data_source": data_provider.mode,
        "positions": positions,
        "total_pnl": round(total_pnl, 2),
        "position_count": len(positions),
    }


@app.get("/api/holdings/{user_id}")
async def get_holdings(user_id: str):
    """Get demat holdings — live from Shoonya or mock."""
    holdings = data_provider.get_holdings(user_id)
    total_value = sum(h.get("value", 0) for h in holdings)
    return {
        "user_id": user_id,
        "data_source": data_provider.mode,
        "holdings": holdings,
        "total_value": round(total_value, 2),
        "holdings_count": len(holdings),
    }


# ══════════════════════════════════════
# Market Quotes (Shoonya-powered)
# ══════════════════════════════════════

@app.get("/api/quote/{symbol}")
async def get_quote(symbol: str, exchange: str = "NSE"):
    """Get live market quote for a symbol."""
    quote = data_provider.get_quote(symbol, exchange)
    if not quote:
        raise HTTPException(status_code=404, detail=f"Quote not found for {symbol}")
    return {
        "data_source": data_provider.mode,
        "quote": quote,
    }


# ══════════════════════════════════════
# Sentinel-Gated Order Placement
# ══════════════════════════════════════

class PlaceOrderRequest(BaseModel):
    symbol: str
    trade_type: str  # BUY or SELL
    quantity: int
    price: float = 0  # 0 = market order
    exchange: str = "NSE"
    product_type: str = "C"  # C=CNC, I=MIS, M=NRML
    price_type: str = "MKT"  # MKT or LMT
    sentinel_approved: bool = False  # Must be True to proceed


@app.post("/api/place-order")
async def place_order(req: PlaceOrderRequest):
    """
    Place a trade through Shoonya — ONLY after Sentinel behavioral analysis.
    The order is first analyzed for emotional patterns before execution.
    """
    # Step 1: Sentinel must approve the trade
    if not req.sentinel_approved:
        # Run behavioral analysis first
        user_trades = TRADE_DATA.get("user_001", [])
        avg_position = data_provider.get_portfolio_value() * 0.05
        position_size = req.quantity * req.price if req.price > 0 else req.quantity * 100

        trade_features = {
            "time_since_last_loss_minutes": None,
            "trades_in_last_30_min": len([
                t for t in user_trades[-20:]
                if t.get("source") == "shoonya_live"
            ]) + 1,
            "trade_hour": datetime.now().hour,
            "position_size_vs_avg": position_size / avg_position if avg_position > 0 else 1.0,
            "followed_social_tip": False,
            "last_loss_amount": 0,
        }

        prediction = predict_pattern(trade_features)
        risk_data = risk_engine.calculate_live_risk_score(user_trades[-20:])
        combined_risk = min(
            100,
            int(prediction["risk_score"] * 0.6 + risk_data["score"] * 0.4)
        )

        if combined_risk >= 60:
            return {
                "status": "BLOCKED",
                "message": "⚠️ Sentinel detected high-risk behavioral pattern",
                "risk_score": combined_risk,
                "detected_pattern": prediction.get("predicted_pattern", "unknown"),
                "recommendation": "Take a 5-minute cool-down before retrying",
                "sentinel_approved": False,
            }

    # Step 2: Place the order
    result = data_provider.place_order(
        symbol=req.symbol,
        trade_type=req.trade_type,
        quantity=req.quantity,
        price=req.price,
        exchange=req.exchange,
        product_type=req.product_type,
        price_type=req.price_type,
    )

    return {
        **result,
        "data_source": data_provider.mode,
        "sentinel_approved": True,
    }


# ══════════════════════════════════════
# Portfolio Summary (Shoonya-powered)
# ══════════════════════════════════════

@app.get("/api/portfolio/{user_id}")
async def get_portfolio(user_id: str):
    """Get complete portfolio summary with positions, holdings, and value."""
    positions = data_provider.get_positions(user_id)
    holdings = data_provider.get_holdings(user_id)
    portfolio_value = data_provider.get_portfolio_value(user_id)

    return {
        "user_id": user_id,
        "data_source": data_provider.mode,
        "portfolio_value": round(portfolio_value, 2),
        "positions": positions,
        "holdings": holdings,
        "total_positions": len(positions),
        "total_holdings": len(holdings),
    }


# ══════════════════════════════════════
# Run server
# ══════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
