"""
SENTINEL — Behavioral ML Model
RandomForestClassifier trained on mock data to predict dangerous
emotional trading patterns in real-time.
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder

from models.mock_data import generate_mock_trades

# ── Constants ──
MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved")
MODEL_PATH = os.path.join(MODEL_DIR, "behavioral_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")

# Feature columns used for training
FEATURE_COLS = [
    "time_since_last_loss_minutes",
    "trades_in_last_30_min",
    "trade_hour",
    "position_size_vs_avg",
    "followed_social_tip",
]

# Risk score multipliers by pattern (higher = more dangerous)
PATTERN_RISK_SCORES = {
    "normal": 10,
    "revenge_trade": 85,
    "fomo_trade": 65,
    "overtrading": 75,
    "late_night_trade": 40,
    "panic_sell": 90,
    "herd_trade": 55,
}

# Human-readable messages for each pattern
PATTERN_MESSAGES = {
    "revenge_trade": (
        "You've placed {trades} trades in {minutes:.0f} minutes after your "
        "last loss of ₹{loss:,.0f}. Your win rate in this pattern: "
        "{win_rate:.0f}%. Average loss: ₹{avg_loss:,.0f}."
    ),
    "fomo_trade": (
        "Your position size is {size_ratio:.1f}x your 30-day average. "
        "FOMO trades in your history have a {win_rate:.0f}% win rate "
        "with an average loss of ₹{avg_loss:,.0f}."
    ),
    "overtrading": (
        "You've placed {trades} trades in the last 30 minutes. "
        "When you overtrade, your win rate drops to {win_rate:.0f}% "
        "with an average loss of ₹{avg_loss:,.0f}."
    ),
    "late_night_trade": (
        "Trading at {hour}:00 — markets are closed and liquidity is low. "
        "Your late-night trades have a {win_rate:.0f}% win rate."
    ),
    "panic_sell": (
        "Selling within {minutes:.0f} minutes of a significant portfolio drop. "
        "Panic sells in your history recover {recovery:.0f}% of the time."
    ),
    "herd_trade": (
        "This trade follows a social media tip. Tip-based trades in your "
        "history have a {win_rate:.0f}% win rate with average loss of ₹{avg_loss:,.0f}."
    ),
    "normal": (
        "This trade looks well-considered. Your fundamentals-based "
        "trades have a {win_rate:.0f}% win rate. Keep it up!"
    ),
}


def train_model(force_retrain: bool = False) -> dict:
    """
    Train the behavioral pattern classifier on mock data.
    Returns training metrics.
    """
    os.makedirs(MODEL_DIR, exist_ok=True)

    # Skip if model already exists and no force retrain
    if os.path.exists(MODEL_PATH) and not force_retrain:
        print("Model already trained. Use force_retrain=True to retrain.")
        return {"status": "already_trained"}

    print("Training behavioral model...")
    df = generate_mock_trades()

    # Prepare features
    df["followed_social_tip"] = df["followed_social_tip"].astype(int)
    df["time_since_last_loss_minutes"] = df["time_since_last_loss_minutes"].fillna(999)

    X = df[FEATURE_COLS].values
    y = df["behavioral_pattern"].values

    # Encode labels
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    # Train Random Forest with tuned hyperparameters
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=le.classes_)

    print(f"\nModel Accuracy: {accuracy:.2%}")
    print(f"\n{report}")

    # Save model and encoder
    joblib.dump(model, MODEL_PATH)
    joblib.dump(le, ENCODER_PATH)
    print(f"Model saved -> {MODEL_PATH}")

    return {
        "status": "trained",
        "accuracy": round(accuracy, 4),
        "report": report,
    }


def _load_model():
    """Load the trained model and label encoder from disk."""
    if not os.path.exists(MODEL_PATH):
        train_model()
    model = joblib.load(MODEL_PATH)
    le = joblib.load(ENCODER_PATH)
    return model, le


def _get_historical_stats(pattern: str) -> dict:
    """
    Get historical win rate and average loss for a pattern
    from the mock dataset.
    """
    df = generate_mock_trades()
    pattern_df = df[df["behavioral_pattern"] == pattern]

    if len(pattern_df) == 0:
        return {"win_rate": 0, "avg_loss": 0, "total_count": 0}

    wins = len(pattern_df[pattern_df["outcome"] == "WIN"])
    losses_df = pattern_df[pattern_df["outcome"] == "LOSS"]

    return {
        "win_rate": round(wins / len(pattern_df) * 100, 1),
        "avg_loss": round(losses_df["pnl"].mean(), 2) if len(losses_df) > 0 else 0,
        "total_count": len(pattern_df),
        "total_loss": round(losses_df["pnl"].sum(), 2) if len(losses_df) > 0 else 0,
    }


def predict_pattern(trade_features: dict) -> dict:
    """
    Predict the behavioral pattern for a proposed trade.

    Args:
        trade_features: dict with keys matching FEATURE_COLS:
            - time_since_last_loss_minutes (float or None)
            - trades_in_last_30_min (int)
            - trade_hour (int)
            - position_size_vs_avg (float)
            - followed_social_tip (bool or int)

    Returns:
        dict with pattern prediction, confidence, risk score,
        historical stats, and human-readable intervention message.
    """
    model, le = _load_model()

    # Prepare features
    features = np.array([[
        trade_features.get("time_since_last_loss_minutes") or 999,
        trade_features.get("trades_in_last_30_min", 1),
        trade_features.get("trade_hour", 12),
        trade_features.get("position_size_vs_avg", 1.0),
        int(trade_features.get("followed_social_tip", False)),
    ]])

    # Predict with probabilities
    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]

    pattern = le.inverse_transform([prediction])[0]
    confidence = round(float(probabilities[prediction]), 2)

    # Fetch historical stats for this pattern
    stats = _get_historical_stats(pattern)
    risk_score = PATTERN_RISK_SCORES.get(pattern, 50)

    # Adjust risk score based on confidence
    risk_score = min(100, int(risk_score * (0.7 + 0.3 * confidence)))

    # Generate human-readable message
    message_template = PATTERN_MESSAGES.get(pattern, "Trade analysis complete.")
    try:
        message = message_template.format(
            trades=trade_features.get("trades_in_last_30_min", 1),
            minutes=trade_features.get("time_since_last_loss_minutes") or 0,
            loss=abs(trade_features.get("last_loss_amount", 0)),
            win_rate=stats["win_rate"],
            avg_loss=abs(stats["avg_loss"]),
            size_ratio=trade_features.get("position_size_vs_avg", 1.0),
            hour=trade_features.get("trade_hour", 12),
            recovery=35,  # Mock recovery rate for panic sells
        )
    except (KeyError, ValueError):
        message = f"Detected pattern: {pattern} (confidence: {confidence:.0%})"

    return {
        "pattern": pattern,
        "confidence": confidence,
        "risk_score": risk_score,
        "historical_win_rate": stats["win_rate"] / 100,
        "historical_avg_loss": stats["avg_loss"],
        "historical_total_loss": stats.get("total_loss", 0),
        "historical_count": stats.get("total_count", 0),
        "message": message,
        "intervention_needed": risk_score >= 60,
    }


if __name__ == "__main__":
    # Train the model
    result = train_model(force_retrain=True)
    print(f"\n{'='*50}")
    print("Testing prediction...")

    # Test: Revenge trade scenario
    test_trade = {
        "time_since_last_loss_minutes": 4,
        "trades_in_last_30_min": 3,
        "trade_hour": 10,
        "position_size_vs_avg": 1.5,
        "followed_social_tip": False,
        "last_loss_amount": 3200,
    }
    result = predict_pattern(test_trade)
    print(f"\n🎯 Prediction: {result['pattern']}")
    print(f"🎲 Confidence: {result['confidence']:.0%}")
    print(f"⚠️  Risk Score: {result['risk_score']}/100")
    print(f"💬 Message: {result['message']}")
