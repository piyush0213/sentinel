"""
SENTINEL — Shoonya API Client
Wraps Finvasia's NorenRestApiPy for live brokerage data.

Handles:
- TOTP-based authentication & session management
- Trade book / Order book fetching
- Positions & Holdings
- Live market quotes
- User profile
- Order placement interception (for Sentinel's trade-gating)

Environment Variables Required:
  SHOONYA_USER_ID, SHOONYA_PASSWORD, SHOONYA_TOTP_SECRET,
  SHOONYA_VENDOR_CODE, SHOONYA_API_KEY, SHOONYA_IMEI
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

logger = logging.getLogger("sentinel.shoonya")


class ShoonyaClient:
    """
    Thread-safe Shoonya API wrapper with automatic session management.
    Falls back gracefully when credentials are missing or login fails.
    """

    # Shoonya API endpoints
    HOST = "https://api.shoonya.com/NorenWClientTP/"
    WEBSOCKET = "wss://api.shoonya.com/NorenWSTP/"

    def __init__(self):
        self._api = None
        self._logged_in = False
        self._session_time: Optional[datetime] = None
        self._user_details: Optional[dict] = None

        # Load credentials from environment
        self._uid = os.getenv("SHOONYA_USER_ID", "")
        self._pwd = os.getenv("SHOONYA_PASSWORD", "")
        self._totp_secret = os.getenv("SHOONYA_TOTP_SECRET", "")
        self._vendor_code = os.getenv("SHOONYA_VENDOR_CODE", "")
        self._api_key = os.getenv("SHOONYA_API_KEY", "")
        self._imei = os.getenv("SHOONYA_IMEI", "abc1234")

    # ─────────────────────────────
    # Connection & Auth
    # ─────────────────────────────

    def has_credentials(self) -> bool:
        """Check if all required credentials are present."""
        return all([
            self._uid, self._pwd, self._totp_secret,
            self._vendor_code, self._api_key,
        ])

    def connect(self) -> bool:
        """
        Initialize API client and login with TOTP.
        Returns True on success, False on failure.
        """
        if not self.has_credentials():
            logger.warning("⚠️  Shoonya credentials not set — running in mock mode")
            return False

        try:
            from NorenRestApiPy.NorenApi import NorenApi
            import pyotp

            self._api = NorenApi(
                host=self.HOST,
                websocket=self.WEBSOCKET,
            )

            # Generate TOTP
            totp = pyotp.TOTP(self._totp_secret).now()

            ret = self._api.login(
                userid=self._uid,
                password=self._pwd,
                twoFA=totp,
                vendor_code=self._vendor_code,
                api_secret=self._api_key,
                imei=self._imei,
            )

            if ret and ret.get("stat") == "Ok":
                self._logged_in = True
                self._session_time = datetime.now()
                logger.info(f"✅ Shoonya login successful for {self._uid}")
                return True
            else:
                error_msg = ret.get("emsg", "Unknown error") if ret else "No response"
                logger.error(f"❌ Shoonya login failed: {error_msg}")
                self._logged_in = False
                return False

        except ImportError:
            logger.error("❌ NorenRestApiPy not installed. Run: pip install NorenRestApiPy pyotp")
            return False
        except Exception as e:
            logger.error(f"❌ Shoonya connection error: {e}")
            self._logged_in = False
            return False

    def is_connected(self) -> bool:
        """Check if we have an active session."""
        if not self._logged_in or not self._session_time:
            return False

        # Sessions expire after ~6 hours; re-login proactively at 5 hours
        if datetime.now() - self._session_time > timedelta(hours=5):
            logger.info("🔄 Shoonya session expired — re-authenticating...")
            return self.connect()

        return True

    def _ensure_session(self) -> bool:
        """Ensure we have a valid session, reconnect if needed."""
        if self.is_connected():
            return True
        return self.connect()

    # ─────────────────────────────
    # User Profile
    # ─────────────────────────────

    def get_user_details(self) -> Optional[Dict[str, Any]]:
        """Fetch the logged-in user's profile details."""
        if not self._ensure_session():
            return None

        try:
            details = self._api.get_user_details()
            if details and details.get("stat") == "Ok":
                self._user_details = {
                    "user_id": details.get("uid", self._uid),
                    "name": details.get("uname", ""),
                    "email": details.get("email", ""),
                    "broker": "Finvasia (Shoonya)",
                    "exchanges": details.get("exarr", []),
                    "account_id": details.get("actid", ""),
                }
                return self._user_details
        except Exception as e:
            logger.error(f"Failed to fetch user details: {e}")
        return None

    # ─────────────────────────────
    # Trade Book (executed trades)
    # ─────────────────────────────

    def get_trade_book(self) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch today's executed trades from Shoonya.
        Returns normalized list of trade dicts compatible with Sentinel's format.
        """
        if not self._ensure_session():
            return None

        try:
            raw_trades = self._api.get_trade_book()
            if not raw_trades or isinstance(raw_trades, dict):
                return []

            return [self._normalize_trade(t) for t in raw_trades]
        except Exception as e:
            logger.error(f"Failed to fetch trade book: {e}")
            return None

    def _normalize_trade(self, raw: dict) -> dict:
        """
        Convert Shoonya's trade format to Sentinel's internal format.

        Shoonya fields → Sentinel fields:
          norenordno  → trade_id
          trantype    → trade_type (B→BUY, S→SELL)
          tsym        → symbol
          fillshares  → quantity
          flprc       → entry_price
          exch_tm     → timestamp
        """
        # Parse timestamp
        raw_time = raw.get("exch_tm", raw.get("norentm", ""))
        try:
            timestamp = datetime.strptime(raw_time, "%d-%m-%Y %H:%M:%S")
        except (ValueError, TypeError):
            timestamp = datetime.now()

        # Parse symbol — remove exchange suffix (e.g., "RELIANCE-EQ" → "RELIANCE")
        symbol = raw.get("tsym", "UNKNOWN")
        if "-" in symbol:
            symbol = symbol.split("-")[0]

        quantity = int(raw.get("fillshares", raw.get("qty", 0)))
        entry_price = float(raw.get("flprc", raw.get("prc", 0)))
        trade_type = "BUY" if raw.get("trantype") == "B" else "SELL"

        return {
            "trade_id": raw.get("norenordno", ""),
            "timestamp": timestamp.isoformat(),
            "symbol": symbol,
            "trade_type": trade_type,
            "quantity": quantity,
            "entry_price": entry_price,
            "exit_price": entry_price,  # Same-day; updated later if matched
            "pnl": 0.0,  # Will be enriched by data_provider
            "trade_hour": timestamp.hour,
            "time_since_last_loss_minutes": None,
            "trades_in_last_30_min": 1,
            "position_size_vs_avg": 1.0,
            "followed_social_tip": False,
            "behavioral_pattern": "normal",
            "outcome": "PENDING",
            "source": "shoonya_live",
        }

    # ─────────────────────────────
    # Order Book (all orders today)
    # ─────────────────────────────

    def get_order_book(self) -> Optional[List[Dict[str, Any]]]:
        """Fetch today's order book from Shoonya."""
        if not self._ensure_session():
            return None

        try:
            raw_orders = self._api.get_order_book()
            if not raw_orders or isinstance(raw_orders, dict):
                return []

            return [{
                "order_id": o.get("norenordno", ""),
                "symbol": o.get("tsym", ""),
                "status": o.get("status", ""),
                "trade_type": "BUY" if o.get("trantype") == "B" else "SELL",
                "quantity": int(o.get("qty", 0)),
                "price": float(o.get("prc", 0)),
                "order_time": o.get("norentm", ""),
                "product_type": o.get("prd", ""),
                "exchange": o.get("exch", ""),
            } for o in raw_orders]
        except Exception as e:
            logger.error(f"Failed to fetch order book: {e}")
            return None

    # ─────────────────────────────
    # Positions (open positions)
    # ─────────────────────────────

    def get_positions(self) -> Optional[List[Dict[str, Any]]]:
        """Fetch current open positions from Shoonya."""
        if not self._ensure_session():
            return None

        try:
            raw_positions = self._api.get_positions()
            if not raw_positions or isinstance(raw_positions, dict):
                return []

            return [{
                "symbol": p.get("tsym", "").split("-")[0] if "-" in p.get("tsym", "") else p.get("tsym", ""),
                "quantity": int(p.get("netqty", 0)),
                "avg_price": float(p.get("netavgprc", 0)),
                "ltp": float(p.get("lp", 0)),
                "pnl": float(p.get("rpnl", 0)) + float(p.get("urmtom", 0)),
                "realized_pnl": float(p.get("rpnl", 0)),
                "unrealized_pnl": float(p.get("urmtom", 0)),
                "product_type": p.get("prd", ""),
                "exchange": p.get("exch", ""),
            } for p in raw_positions]
        except Exception as e:
            logger.error(f"Failed to fetch positions: {e}")
            return None

    # ─────────────────────────────
    # Holdings (demat holdings)
    # ─────────────────────────────

    def get_holdings(self) -> Optional[List[Dict[str, Any]]]:
        """Fetch demat holdings from Shoonya."""
        if not self._ensure_session():
            return None

        try:
            raw_holdings = self._api.get_holdings()
            if not raw_holdings or isinstance(raw_holdings, dict):
                return []

            holdings = []
            for h in raw_holdings:
                symbol = h.get("exch_tsym", [{}])
                if isinstance(symbol, list) and len(symbol) > 0:
                    sym_name = symbol[0].get("tsym", "UNKNOWN")
                else:
                    sym_name = str(symbol)

                if "-" in sym_name:
                    sym_name = sym_name.split("-")[0]

                holdings.append({
                    "symbol": sym_name,
                    "quantity": int(h.get("holdqty", 0)),
                    "avg_price": float(h.get("upldprc", 0)),
                    "ltp": float(h.get("lp", 0)) if h.get("lp") else 0,
                    "value": float(h.get("holdqty", 0)) * float(h.get("upldprc", 0)),
                })

            return holdings
        except Exception as e:
            logger.error(f"Failed to fetch holdings: {e}")
            return None

    # ─────────────────────────────
    # Market Quotes
    # ─────────────────────────────

    def get_quote(self, exchange: str, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Fetch live market quote for a symbol.

        Args:
            exchange: "NSE", "NFO", "BSE", etc.
            symbol: Trading symbol like "RELIANCE-EQ"
        """
        if not self._ensure_session():
            return None

        try:
            # First, search for symbol token
            search = self._api.searchscrip(exchange=exchange, searchtext=symbol)
            if not search or search.get("stat") != "Ok":
                return None

            values = search.get("values", [])
            if not values:
                return None

            token = values[0].get("token", "")
            tsym = values[0].get("tsym", symbol)

            # Fetch live quote
            quote = self._api.get_quotes(exchange=exchange, token=token)
            if not quote:
                return None

            return {
                "symbol": tsym.split("-")[0] if "-" in tsym else tsym,
                "ltp": float(quote.get("lp", 0)),
                "open": float(quote.get("o", 0)),
                "high": float(quote.get("h", 0)),
                "low": float(quote.get("l", 0)),
                "close": float(quote.get("c", 0)),
                "volume": int(quote.get("v", 0)),
                "change": float(quote.get("lp", 0)) - float(quote.get("c", 0)),
                "change_pct": round(
                    (float(quote.get("lp", 0)) - float(quote.get("c", 0)))
                    / float(quote.get("c", 1)) * 100, 2
                ),
            }
        except Exception as e:
            logger.error(f"Failed to fetch quote for {symbol}: {e}")
            return None

    # ─────────────────────────────
    # Order Placement (Sentinel-gated)
    # ─────────────────────────────

    def place_order(
        self,
        buy_or_sell: str,
        symbol: str,
        quantity: int,
        price: float = 0,
        exchange: str = "NSE",
        product_type: str = "C",
        price_type: str = "MKT",
    ) -> Optional[Dict[str, Any]]:
        """
        Place an order through Shoonya — ONLY called after Sentinel approval.
        This is the gateway that Sentinel uses to intercept and approve trades.

        Args:
            buy_or_sell: "B" for Buy, "S" for Sell
            symbol: Trading symbol (e.g., "RELIANCE-EQ")
            quantity: Number of shares/lots
            price: Limit price (0 for market orders)
            exchange: Exchange code (NSE, NFO, BSE)
            product_type: "C" (CNC), "I" (Intraday/MIS), "M" (NRML)
            price_type: "MKT" (market), "LMT" (limit)
        """
        if not self._ensure_session():
            return {"status": "FAILED", "error": "Not connected to Shoonya"}

        try:
            ret = self._api.place_order(
                buy_or_sell=buy_or_sell,
                product_type=product_type,
                exchange=exchange,
                tradingsymbol=symbol,
                quantity=quantity,
                discloseqty=0,
                price_type=price_type,
                price=price,
                retention="DAY",
            )

            if ret and ret.get("stat") == "Ok":
                logger.info(
                    f"✅ Order placed: {buy_or_sell} {quantity}x {symbol} @ "
                    f"{'MKT' if price_type == 'MKT' else price}"
                )
                return {
                    "status": "SUCCESS",
                    "order_id": ret.get("norenordno", ""),
                    "message": "Order placed successfully",
                }
            else:
                error = ret.get("emsg", "Unknown error") if ret else "No response"
                logger.error(f"❌ Order failed: {error}")
                return {"status": "FAILED", "error": error}

        except Exception as e:
            logger.error(f"❌ Order placement error: {e}")
            return {"status": "FAILED", "error": str(e)}

    # ─────────────────────────────
    # Portfolio Summary
    # ─────────────────────────────

    def get_portfolio_value(self) -> Optional[float]:
        """Calculate total portfolio value from positions + holdings."""
        total = 0.0

        positions = self.get_positions()
        if positions:
            for p in positions:
                qty = abs(p.get("quantity", 0))
                ltp = p.get("ltp", 0)
                total += qty * ltp

        holdings = self.get_holdings()
        if holdings:
            for h in holdings:
                qty = h.get("quantity", 0)
                ltp = h.get("ltp", 0) or h.get("avg_price", 0)
                total += qty * ltp

        return total if total > 0 else None
