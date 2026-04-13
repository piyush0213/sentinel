"""
SENTINEL — Portfolio Stress Test Simulator
Simulates portfolio performance under historical crash scenarios.
All scenarios are based on real market events.
"""

from typing import Dict, List, Optional


# ── Historical crash scenarios ──
SCENARIOS = {
    "2020_crash": {
        "name": "COVID-19 Crash (March 2020)",
        "description": "NIFTY fell 38% from Jan peak to March low in 45 days",
        "overall_drop": -0.35,
        "sector_impacts": {
            "IT": -0.28, "Banking": -0.45, "Auto": -0.40,
            "Energy": -0.38, "FMCG": -0.20, "Finance": -0.48,
            "Index": -0.35, "Pharma": -0.15,
        },
        "recovery_days": 180,
        "volatility_spike": 3.5,
    },
    "2008_crisis": {
        "name": "Global Financial Crisis (2008)",
        "description": "Sensex dropped 55% from peak. Worst crash in Indian market history.",
        "overall_drop": -0.55,
        "sector_impacts": {
            "IT": -0.42, "Banking": -0.65, "Auto": -0.58,
            "Energy": -0.50, "FMCG": -0.30, "Finance": -0.70,
            "Index": -0.55, "Pharma": -0.25,
        },
        "recovery_days": 540,
        "volatility_spike": 5.0,
    },
    "2024_correction": {
        "name": "2024 Mid-Cap Correction",
        "description": "NIFTY corrected ~12% amid global rate hike fears.",
        "overall_drop": -0.12,
        "sector_impacts": {
            "IT": -0.15, "Banking": -0.10, "Auto": -0.14,
            "Energy": -0.08, "FMCG": -0.06, "Finance": -0.18,
            "Index": -0.12, "Pharma": -0.05,
        },
        "recovery_days": 45,
        "volatility_spike": 1.5,
    },
    "flash_crash": {
        "name": "Flash Crash Scenario",
        "description": "Sudden 8% intraday drop due to algorithmic selling cascade.",
        "overall_drop": -0.08,
        "sector_impacts": {
            "IT": -0.07, "Banking": -0.10, "Auto": -0.09,
            "Energy": -0.06, "FMCG": -0.04, "Finance": -0.12,
            "Index": -0.08, "Pharma": -0.03,
        },
        "recovery_days": 5,
        "volatility_spike": 4.0,
    },
    "sector_collapse": {
        "name": "Sector Collapse (Banking Crisis)",
        "description": "Banking sector drops 40% due to NPA crisis + rate shock.",
        "overall_drop": -0.20,
        "sector_impacts": {
            "IT": -0.05, "Banking": -0.40, "Auto": -0.15,
            "Energy": -0.10, "FMCG": -0.03, "Finance": -0.45,
            "Index": -0.20, "Pharma": -0.02,
        },
        "recovery_days": 270,
        "volatility_spike": 2.5,
    },
}

# Sector mapping for NSE symbols
SYMBOL_SECTORS = {
    "RELIANCE": "Energy", "TCS": "IT", "INFY": "IT", "HDFC": "Banking",
    "ICICIBANK": "Banking", "NIFTY50": "Index", "BANKNIFTY": "Index",
    "WIPRO": "IT", "TATAMOTORS": "Auto", "SBIN": "Banking",
    "BAJFINANCE": "Finance", "MARUTI": "Auto", "ITC": "FMCG",
    "HCLTECH": "IT", "AXISBANK": "Banking",
}


class StressTestService:
    """
    Portfolio stress testing engine.
    Simulates portfolio performance under 5 historical crash scenarios.
    """

    def run_stress_test(
        self,
        portfolio: dict,
        scenario: str
    ) -> dict:
        """
        Run a stress test on a portfolio under a given scenario.

        Args:
            portfolio: {
                "portfolio_value": float,
                "positions": [
                    {"symbol": str, "value": float, "sector": str},
                    ...
                ]
            }
            scenario: one of the SCENARIOS keys

        Returns:
            dict with projected losses, recovery estimates,
            margin call risk, and recommended hedges.
        """
        if scenario not in SCENARIOS:
            return {"error": f"Unknown scenario: {scenario}"}

        scenario_data = SCENARIOS[scenario]
        portfolio_value = portfolio.get("portfolio_value", 0)
        positions = portfolio.get("positions", [])

        # Calculate position-level impacts
        position_results = []
        total_projected_loss = 0

        for pos in positions:
            symbol = pos.get("symbol", "")
            value = pos.get("value", 0)
            sector = pos.get("sector") or SYMBOL_SECTORS.get(symbol, "Index")

            # Get sector-specific impact, default to overall drop
            impact = scenario_data["sector_impacts"].get(
                sector, scenario_data["overall_drop"]
            )

            projected_loss = round(value * impact, 2)
            projected_value = round(value + projected_loss, 2)
            total_projected_loss += projected_loss

            position_results.append({
                "symbol": symbol,
                "sector": sector,
                "current_value": value,
                "impact_percentage": round(impact * 100, 1),
                "projected_loss": projected_loss,
                "projected_value": max(0, projected_value),
            })

        # If no positions, use overall portfolio drop
        if not positions:
            total_projected_loss = round(
                portfolio_value * scenario_data["overall_drop"], 2
            )

        projected_portfolio = round(portfolio_value + total_projected_loss, 2)

        # Margin call analysis (triggered if portfolio drops below 50% margin)
        margin_threshold = portfolio_value * 0.50
        margin_call_risk = projected_portfolio < margin_threshold

        # Recommended hedges based on scenario
        hedges = self._recommend_hedges(scenario, positions)

        return {
            "scenario": scenario,
            "scenario_name": scenario_data["name"],
            "scenario_description": scenario_data["description"],
            "current_portfolio_value": portfolio_value,
            "projected_portfolio_value": max(0, projected_portfolio),
            "projected_loss_inr": total_projected_loss,
            "projected_loss_percentage": round(
                (total_projected_loss / portfolio_value * 100), 1
            ) if portfolio_value > 0 else 0,
            "recovery_days_estimate": scenario_data["recovery_days"],
            "volatility_spike_factor": scenario_data["volatility_spike"],
            "margin_call_risk": margin_call_risk,
            "position_impacts": position_results,
            "recommended_hedge": hedges,
        }

    def run_all_scenarios(self, portfolio: dict) -> list:
        """Run stress tests for all available scenarios."""
        results = []
        for scenario_key in SCENARIOS:
            result = self.run_stress_test(portfolio, scenario_key)
            results.append(result)
        return results

    def _recommend_hedges(
        self, scenario: str, positions: list
    ) -> list:
        """Generate hedge recommendations based on scenario and positions."""
        hedges = []

        # Count sector exposures
        sector_exposure = {}
        for pos in positions:
            sector = pos.get("sector") or SYMBOL_SECTORS.get(
                pos.get("symbol", ""), "Index"
            )
            sector_exposure[sector] = (
                sector_exposure.get(sector, 0) + pos.get("value", 0)
            )

        # General hedging recommendations
        hedges.append({
            "type": "NIFTY PUT",
            "description": "Buy NIFTY 50 PUT options as portfolio insurance",
            "rationale": "Provides downside protection during broad market declines",
        })

        # Sector-specific hedges
        if "Banking" in sector_exposure and sector_exposure["Banking"] > 0:
            hedges.append({
                "type": "BANKNIFTY PUT",
                "description": "Buy BANKNIFTY PUT to hedge banking exposure",
                "rationale": f"Your banking exposure is ₹{sector_exposure['Banking']:,.0f}",
            })

        if scenario in ["2008_crisis", "2020_crash"]:
            hedges.append({
                "type": "GOLD ETF",
                "description": "Increase gold allocation to 10-15% of portfolio",
                "rationale": "Gold historically rises during systemic crises",
            })

        hedges.append({
            "type": "STOP LOSS",
            "description": "Set strict stop losses at 5% below current levels",
            "rationale": "Limits maximum loss per position during sharp declines",
        })

        return hedges

    def get_available_scenarios(self) -> list:
        """Return list of available stress test scenarios."""
        return [
            {
                "key": key,
                "name": data["name"],
                "description": data["description"],
                "overall_drop": data["overall_drop"],
                "recovery_days": data["recovery_days"],
            }
            for key, data in SCENARIOS.items()
        ]
