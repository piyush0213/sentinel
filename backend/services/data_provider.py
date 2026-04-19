"""
SENTINEL — Unified Data Provider
Single interface for all trading data. Automatically selects the best
available source:

  Priority: Shoonya Live API → Mock Data (fallback)

This ensures the app works during hackathon demos (mock) AND in
production with real brokerage accounts (Shoonya).
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

import pandas as pd

from models.mock_data import generate_mock_trades, SECTOR_MAP

logger = logging.getLogger("sentinel.data")


class DataProvider:
    """
    Unified data access layer for SENTINEL.

    Tries Shoonya API first; if unavailable, falls back to mock data.
    All downstream services (RiskEngine, StressTest, etc.) consume
    data exclusively through this provider.
    """

    def __init__(self):
        self._shoonya = None
        self._live_mode = False
        self._mock_trades: List[dict] = []
        self._cached_user: Optional[dict] = None

        # Behavioral enrichment state
        self._last_loss_time: Optional[datetime] = None

    # ─────────────────────────────
    # Initialization
    # ─────────────────────────────

    def initialize(self) -> str:
        """
        Initialize the data provider.
        Tries Shoonya first, falls back to mock data.

        Returns:
            "live" or "mock" indicating active mode
        """
        # Try Shoonya connection
        try:
            from services.shoonya_client import ShoonyaClient
            self._shoonya = ShoonyaClient()

            if self._shoonya.has_credentials():
                logger.info("🔌 Shoonya credentials found — attempting live connection...")
                if self._shoonya.connect():
                    self._live_mode = True
                    logger.info("🟢 LIVE MODE — Connected to Shoonya API")
                    return "live"
                else:
                    logger.warning("⚠️  Shoonya login failed — falling back to mock data")
            else:
                logger.info("📋 No Shoonya credentials — using mock data")
        except Exception as e:
            logger.warning(f"⚠️  Shoonya init error: {e} — using mock data")

        # Fallback: generate mock data
        self._live_mode = False
        self._load_mock_data()
        logger.info("🟡 MOCK MODE — Using simulated trading data")
        return "mock"

    def _load_mock_data(self):
        """Generate and cache mock trading data."""
        df = generate_mock_trades()
        trades = df.to_dict("records")

        for t in trades:
            if isinstance(t["timestamp"], pd.Timestamp):
                t["timestamp"] = t["timestamp"].isoformat()
            t["followed_social_tip"] = bool(t["followed_social_tip"])
            t["source"] = "mock"

        self._mock_trades = trades
        logger.info(f"✅ Loaded {len(trades)} mock trades")

    @property
    def is_live(self) -> bool:
        """Whether we're connected to live Shoonya API."""
        return self._live_mode and self._shoonya is not None

    @property
    def mode(self) -> str:
        """Current data source mode."""
        return "live" if self.is_live else "mock"

    # ─────────────────────────────
    # User Profile
    # ─────────────────────────────

    def get_user(self, user_id: str = "user_001") -> dict:
        """Get user profile — live from Shoonya or mock."""
        if self.is_live:
            details = self._shoonya.get_user_details()
            if details:
                return {
                    "user_id": details.get("user_id", user_id),
                    "name": details.get("name", "Shoonya User"),
                    "email": details.get("email", ""),
                    "joined": "N/A",
                    "broker": "Finvasia (Shoonya)",
                    "data_source": "live",
                }

        # Mock fallback
        return {
            "user_id": user_id,
            "name": "Rahul Sharma",
            "email": "rahul@example.com",
            "joined": "2024-06-15",
            "broker": "Mock",
            "data_source": "mock",
        }

    # ─────────────────────────────
    # Trade History
    # ─────────────────────────────

    def get_trades(self, user_id: str = "user_001") -> List[dict]:
        """
        Get all trades — live from Shoonya or mock.
        Live trades are enriched with behavioral pattern detection.
        """
        if self.is_live:
            live_trades = self._shoonya.get_trade_book()
            if live_trades is not None and len(live_trades) > 0:
                enriched = self._enrich_live_trades(live_trades)
                # Merge with any cached mock trades for historical depth
                # (Shoonya only returns today's trades)
                return self._mock_trades + enriched

        return self._mock_trades

    def get_recent_trades(self, user_id: str = "user_001", limit: int = 50) -> List[dict]:
        """Get the most recent N trades."""
        trades = self.get_trades(user_id)
        return trades[-limit:]

    def _enrich_live_trades(self, trades: List[dict]) -> List[dict]:
        """
        Enrich live Shoonya trades with behavioral pattern data.
        This is the core of Sentinel — detecting emotional patterns in real trades.
        """
        enriched = []
        sorted_trades = sorted(trades, key=lambda t: t.get("timestamp", ""))

        for i, trade in enumerate(sorted_trades):
            ts = trade.get("timestamp", "")
            try:
                trade_time = datetime.fromisoformat(ts)
            except (ValueError, TypeError):
                trade_time = datetime.now()

            trade["trade_hour"] = trade_time.hour

            # ── Time since last loss ──
            if self._last_loss_time:
                diff = (trade_time - self._last_loss_time).total_seconds() / 60.0
                trade["time_since_last_loss_minutes"] = round(max(0.5, diff), 2)
            else:
                trade["time_since_last_loss_minutes"] = None

            # ── Trades in last 30 min (from this batch) ──
            window_start = trade_time - timedelta(minutes=30)
            trades_in_window = sum(
                1 for t in sorted_trades[:i]
                if t.get("timestamp", "") >= window_start.isoformat()
            )
            trade["trades_in_last_30_min"] = trades_in_window + 1

            # ── Position size vs average ──
            if enriched:
                avg_qty = sum(
                    t.get("quantity", 0) * t.get("entry_price", 0)
                    for t in enriched
                ) / len(enriched)
                current_size = trade.get("quantity", 0) * trade.get("entry_price", 0)
                trade["position_size_vs_avg"] = round(
                    current_size / avg_qty if avg_qty > 0 else 1.0, 2
                )
            else:
                trade["position_size_vs_avg"] = 1.0

            # ── Behavioral pattern classification ──
            trade["behavioral_pattern"] = self._classify_pattern(trade)

            # ── Outcome from P&L ──
            pnl = trade.get("pnl", 0)
            if pnl > 0:
                trade["outcome"] = "WIN"
            elif pnl < 0:
                trade["outcome"] = "LOSS"
                self._last_loss_time = trade_time
            else:
                trade["outcome"] = "PENDING"

            trade["source"] = "shoonya_live"
            enriched.append(trade)

        return enriched

    def _classify_pattern(self, trade: dict) -> str:
        """Classify a trade's behavioral pattern based on features."""
        # Revenge trade: within 10 min of a loss
        if (trade.get("time_since_last_loss_minutes") is not None
                and trade["time_since_last_loss_minutes"] < 10):
            return "revenge_trade"

        # Overtrading: >5 trades in 30 minutes
        if trade.get("trades_in_last_30_min", 0) > 5:
            return "overtrading"

        # Late night trade: between 22:00 and 06:00
        hour = trade.get("trade_hour", 12)
        if hour >= 22 or hour < 6:
            return "late_night_trade"

        # FOMO: position size > 2x average
        if trade.get("position_size_vs_avg", 1.0) > 2.0:
            return "fomo_trade"

        # Social tip following
        if trade.get("followed_social_tip", False):
            return "herd_trade"

        return "normal"

    # ─────────────────────────────
    # Positions & Holdings
    # ─────────────────────────────

    def get_positions(self, user_id: str = "user_001") -> List[dict]:
        """Get open positions — live or derived from mock data."""
        if self.is_live:
            positions = self._shoonya.get_positions()
            if positions is not None:
                return positions

        # Mock: derive from last few trades
        return self._mock_positions()

    def get_holdings(self, user_id: str = "user_001") -> List[dict]:
        """Get demat holdings — live or derived from mock data."""
        if self.is_live:
            holdings = self._shoonya.get_holdings()
            if holdings is not None:
                return holdings

        # Mock holdings
        return self._mock_holdings()

    def _mock_positions(self) -> List[dict]:
        """Generate mock positions from trade data."""
        from models.mock_data import PRICE_RANGES, NSE_SYMBOLS
        import random

        random.seed(99)
        positions = []
        for sym in random.sample(NSE_SYMBOLS, 5):
            low, high = PRICE_RANGES[sym]
            price = round(random.uniform(low, high), 2)
            qty = random.choice([1, 5, 10, 20])
            positions.append({
                "symbol": sym,
                "quantity": qty,
                "avg_price": price,
                "ltp": round(price * random.uniform(0.95, 1.05), 2),
                "pnl": round(price * qty * random.uniform(-0.03, 0.03), 2),
                "realized_pnl": 0,
                "unrealized_pnl": 0,
                "product_type": "CNC",
                "exchange": "NSE",
            })
        return positions

    def _mock_holdings(self) -> List[dict]:
        """Generate mock holdings."""
        from models.mock_data import PRICE_RANGES
        import random

        random.seed(77)
        symbols = ["RELIANCE", "TCS", "INFY", "HDFC", "ITC", "SBIN"]
        holdings = []
        for sym in symbols:
            low, high = PRICE_RANGES[sym]
            price = round(random.uniform(low, high), 2)
            qty = random.choice([5, 10, 15, 20, 25, 50])
            holdings.append({
                "symbol": sym,
                "quantity": qty,
                "avg_price": price,
                "ltp": round(price * random.uniform(0.97, 1.03), 2),
                "value": round(price * qty, 2),
            })
        return holdings

    # ─────────────────────────────
    # Portfolio Value
    # ─────────────────────────────

    def get_portfolio_value(self, user_id: str = "user_001") -> float:
        """Get total portfolio value — live or estimated from mock."""
        if self.is_live:
            value = self._shoonya.get_portfolio_value()
            if value is not None:
                return value

        # Mock: sum holdings
        holdings = self.get_holdings(user_id)
        return sum(h.get("value", 0) for h in holdings)

    # ─────────────────────────────
    # Market Quotes
    # ─────────────────────────────

    def get_quote(self, symbol: str, exchange: str = "NSE") -> Optional[dict]:
        """Get live market quote for a symbol."""
        if self.is_live:
            # Add -EQ suffix for NSE equity
            search_sym = f"{symbol}-EQ" if exchange == "NSE" and "-" not in symbol else symbol
            quote = self._shoonya.get_quote(exchange, search_sym)
            if quote:
                return quote

        # Mock quote from price ranges
        from models.mock_data import PRICE_RANGES
        import random

        if symbol in PRICE_RANGES:
            low, high = PRICE_RANGES[symbol]
            ltp = round(random.uniform(low, high), 2)
            prev_close = round(ltp * random.uniform(0.98, 1.02), 2)
            return {
                "symbol": symbol,
                "ltp": ltp,
                "open": round(ltp * 0.998, 2),
                "high": round(ltp * 1.01, 2),
                "low": round(ltp * 0.99, 2),
                "close": prev_close,
                "volume": random.randint(100000, 5000000),
                "change": round(ltp - prev_close, 2),
                "change_pct": round((ltp - prev_close) / prev_close * 100, 2),
            }
        return None

    # ─────────────────────────────
    # Order Placement (Sentinel-gated)
    # ─────────────────────────────

    def place_order(
        self,
        symbol: str,
        trade_type: str,
        quantity: int,
        price: float = 0,
        exchange: str = "NSE",
        product_type: str = "C",
        price_type: str = "MKT",
    ) -> dict:
        """
        Place an order — ONLY after Sentinel has approved the trade.
        In mock mode, simulates order placement.
        """
        if self.is_live:
            buy_or_sell = "B" if trade_type.upper() == "BUY" else "S"
            search_sym = f"{symbol}-EQ" if exchange == "NSE" and "-" not in symbol else symbol

            result = self._shoonya.place_order(
                buy_or_sell=buy_or_sell,
                symbol=search_sym,
                quantity=quantity,
                price=price,
                exchange=exchange,
                product_type=product_type,
                price_type=price_type,
            )
            return result

        # Mock order
        return {
            "status": "SIMULATED",
            "order_id": f"MOCK-{datetime.now().strftime('%H%M%S')}",
            "message": f"[MOCK] {trade_type} {quantity}x {symbol} @ {'MKT' if price == 0 else price}",
            "data_source": "mock",
        }

    # ─────────────────────────────
    # Status & Diagnostics
    # ─────────────────────────────

    def get_status(self) -> dict:
        """Get current data provider status for diagnostics."""
        status = {
            "mode": self.mode,
            "live_connected": self.is_live,
            "mock_trades_loaded": len(self._mock_trades),
            "timestamp": datetime.now().isoformat(),
        }

        if self.is_live and self._shoonya:
            status["shoonya_user"] = self._shoonya._uid
            status["session_active"] = self._shoonya.is_connected()

        return status
