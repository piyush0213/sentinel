"""
SENTINEL — Mock Trading Data Generator
Generates 500 realistic trades for demo user "Rahul Sharma" on NSE.
Behavioral pattern trades have significantly lower win rates (15-25%)
compared to normal trades (~55%).
"""

import random
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

# ── NSE symbols used in the mock dataset ──
NSE_SYMBOLS = [
    "RELIANCE", "TCS", "INFY", "HDFC", "ICICIBANK",
    "NIFTY50", "BANKNIFTY", "WIPRO", "TATAMOTORS", "SBIN",
    "BAJFINANCE", "MARUTI", "ITC", "HCLTECH", "AXISBANK"
]

# ── Approximate price ranges for NSE symbols (INR) ──
PRICE_RANGES = {
    "RELIANCE": (2400, 2900), "TCS": (3400, 4200), "INFY": (1400, 1800),
    "HDFC": (1500, 1800), "ICICIBANK": (900, 1200), "NIFTY50": (22000, 24500),
    "BANKNIFTY": (46000, 52000), "WIPRO": (420, 550), "TATAMOTORS": (700, 1000),
    "SBIN": (600, 850), "BAJFINANCE": (6500, 7800), "MARUTI": (10000, 12500),
    "ITC": (420, 500), "HCLTECH": (1300, 1700), "AXISBANK": (1000, 1300)
}

# ── Sector mapping for stress test support ──
SECTOR_MAP = {
    "RELIANCE": "Energy", "TCS": "IT", "INFY": "IT", "HDFC": "Banking",
    "ICICIBANK": "Banking", "NIFTY50": "Index", "BANKNIFTY": "Index",
    "WIPRO": "IT", "TATAMOTORS": "Auto", "SBIN": "Banking",
    "BAJFINANCE": "Finance", "MARUTI": "Auto", "ITC": "FMCG",
    "HCLTECH": "IT", "AXISBANK": "Banking"
}

# ── Win rates by behavioral pattern ──
WIN_RATES = {
    "normal": 0.55,
    "revenge_trade": 0.15,
    "fomo_trade": 0.22,
    "overtrading": 0.18,
    "late_night_trade": 0.20,
    "panic_sell": 0.16,
    "herd_trade": 0.25,
}


def _random_timestamp(start: datetime, end: datetime) -> datetime:
    """Generate a random timestamp between start and end."""
    delta = end - start
    random_seconds = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=random_seconds)


def _assign_behavioral_pattern(trade: dict) -> str:
    """
    Deterministically classify a trade's behavioral pattern
    based on its features. Priority order matters — a trade
    can only have one pattern tag.
    """
    # Revenge trade: within 10 min of a loss
    if (trade["time_since_last_loss_minutes"] is not None
            and trade["time_since_last_loss_minutes"] < 10):
        return "revenge_trade"

    # Overtrading: >5 trades in 30 minutes
    if trade["trades_in_last_30_min"] > 5:
        return "overtrading"

    # Late night trade: between 22:00 and 06:00
    if trade["trade_hour"] >= 22 or trade["trade_hour"] < 6:
        return "late_night_trade"

    # FOMO: position size > 2x average
    if trade["position_size_vs_avg"] > 2.0:
        return "fomo_trade"

    # Herd trade: followed a social media tip
    if trade["followed_social_tip"]:
        return "herd_trade"

    # Panic sell: sell + recent large drop (simulated via rapid sell)
    if (trade["trade_type"] == "SELL"
            and trade["time_since_last_loss_minutes"] is not None
            and trade["time_since_last_loss_minutes"] < 3):
        return "panic_sell"

    return "normal"


def generate_mock_trades(num_trades: int = 500, seed: int = 42) -> pd.DataFrame:
    """
    Generate a realistic mock trading dataset.

    Returns a DataFrame with 500 trades for user "Rahul Sharma"
    spanning the past 6 months. Normal trades win ~55% of the time,
    while emotional trades win only 15-25%.
    """
    random.seed(seed)
    np.random.seed(seed)

    end_date = datetime.now()
    start_date = end_date - timedelta(days=180)

    trades = []
    last_loss_time = None  # Track the last losing trade timestamp

    for i in range(num_trades):
        trade_id = f"TRD-{i+1:04d}"
        timestamp = _random_timestamp(start_date, end_date)
        symbol = random.choice(NSE_SYMBOLS)
        trade_type = random.choice(["BUY", "SELL"])
        quantity = random.choice([1, 2, 5, 10, 15, 20, 25, 50, 100])

        price_low, price_high = PRICE_RANGES[symbol]
        entry_price = round(random.uniform(price_low, price_high), 2)

        # Feature generation with realistic distributions
        time_since_last_loss = None
        if last_loss_time is not None:
            diff = (timestamp - last_loss_time).total_seconds() / 60.0
            time_since_last_loss = round(max(0.5, diff), 2)
            # Sometimes simulate rapid trades after loss
            if random.random() < 0.15:
                time_since_last_loss = round(random.uniform(1, 8), 2)

        trades_in_30 = random.choices(
            [1, 2, 3, 4, 5, 6, 7, 8],
            weights=[30, 25, 15, 10, 8, 5, 4, 3],
            k=1
        )[0]

        # Trading hours: mostly market hours (9-15), some off-hours
        trade_hour = random.choices(
            list(range(24)),
            weights=[1, 1, 1, 1, 1, 1, 2, 3, 5, 15, 15, 15, 12, 12, 10, 8,
                     3, 2, 2, 1, 1, 1, 2, 2],
            k=1
        )[0]

        # Position size vs average: lognormal for realistic distribution
        position_size_vs_avg = round(np.random.lognormal(0, 0.5), 2)
        position_size_vs_avg = max(0.1, min(5.0, position_size_vs_avg))

        # Social tip: ~12% of trades follow tips
        followed_social_tip = random.random() < 0.12

        # Build the trade dict for pattern classification
        trade = {
            "trade_id": trade_id,
            "timestamp": timestamp.isoformat(),
            "symbol": symbol,
            "trade_type": trade_type,
            "quantity": quantity,
            "entry_price": entry_price,
            "trade_hour": trade_hour,
            "time_since_last_loss_minutes": time_since_last_loss,
            "trades_in_last_30_min": trades_in_30,
            "position_size_vs_avg": position_size_vs_avg,
            "followed_social_tip": followed_social_tip,
        }

        # Classify the behavioral pattern
        pattern = _assign_behavioral_pattern(trade)
        trade["behavioral_pattern"] = pattern

        # Determine outcome based on pattern win rate
        win_rate = WIN_RATES[pattern]
        outcome = "WIN" if random.random() < win_rate else "LOSS"
        trade["outcome"] = outcome

        # Calculate P&L based on outcome
        if outcome == "WIN":
            pct_gain = random.uniform(0.5, 4.0) / 100
            exit_price = round(entry_price * (1 + pct_gain), 2)
        else:
            pct_loss = random.uniform(0.5, 6.0) / 100
            exit_price = round(entry_price * (1 - pct_loss), 2)

        # Invert for SELL trades
        if trade_type == "SELL":
            pnl = round((entry_price - exit_price) * quantity, 2)
        else:
            pnl = round((exit_price - entry_price) * quantity, 2)

        trade["exit_price"] = exit_price
        trade["pnl"] = pnl

        # Track losses for time_since_last_loss feature
        if outcome == "LOSS":
            last_loss_time = timestamp

        trades.append(trade)

    # Sort by timestamp for chronological order
    df = pd.DataFrame(trades)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["trade_id"] = [f"TRD-{i+1:04d}" for i in range(len(df))]

    return df


def save_mock_data(filepath: str = None) -> str:
    """Generate and save mock data to CSV. Returns the file path."""
    if filepath is None:
        filepath = os.path.join(os.path.dirname(__file__), "trades.csv")

    df = generate_mock_trades()
    df.to_csv(filepath, index=False)
    print(f"✅ Generated {len(df)} mock trades → {filepath}")

    # Print summary stats
    pattern_counts = df["behavioral_pattern"].value_counts()
    print("\n📊 Pattern Distribution:")
    for pattern, count in pattern_counts.items():
        win_count = len(df[(df["behavioral_pattern"] == pattern) & (df["outcome"] == "WIN")])
        win_rate = win_count / count * 100
        print(f"   {pattern:20s}: {count:4d} trades | Win Rate: {win_rate:.1f}%")

    total_pnl = df["pnl"].sum()
    emotional_pnl = df[df["behavioral_pattern"] != "normal"]["pnl"].sum()
    print(f"\n💰 Total P&L: ₹{total_pnl:,.2f}")
    print(f"😰 Emotional Trade P&L: ₹{emotional_pnl:,.2f}")
    print(f"📈 Recoverable if emotional trades avoided: ₹{abs(emotional_pnl):,.2f}")

    return filepath


if __name__ == "__main__":
    save_mock_data()
