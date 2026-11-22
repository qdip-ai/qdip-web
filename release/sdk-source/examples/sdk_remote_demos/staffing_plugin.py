"""Remote demo B: shift capacity planning for two independently staffed periods.

Shift assignments can reuse people across non-overlapping periods.
The bound is PER PERIOD; unique employee identities are not modeled.
Uses INTEGER variables, two GE constraints and a MINIMIZE objective.
Outputs a DecisionSpec only; QDIP Server remains decision authority.
"""
from __future__ import annotations

from typing import Any


def _bounded_int(value: Any, name: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{name} must be an integer in [{low}, {high}]")
    return value


def make_spec(payload: dict[str, Any], decision_id: str) -> dict[str, Any]:
    expected = {
        "max_agents_per_period", "morning_coverage", "evening_coverage",
        "morning_cost", "evening_cost",
    }
    if set(payload) != expected:
        raise ValueError("Expected the five staffing fields only")
    max_agents_per_period = _bounded_int(
        payload["max_agents_per_period"], "max_agents_per_period", 0, 20
    )
    morning = _bounded_int(payload["morning_coverage"], "morning_coverage", 0, 60)
    evening = _bounded_int(payload["evening_coverage"], "evening_coverage", 0, 60)
    m_cost = _bounded_int(payload["morning_cost"], "morning_cost", 1, 100)
    e_cost = _bounded_int(payload["evening_cost"], "evening_cost", 1, 100)

    return {
        "semantic_version": "1.0.0",
        "decision_id": decision_id,
        "variables": [
            {"id": "morning_agents", "kind": "INTEGER",
             "lower_bound": "0", "upper_bound": str(max_agents_per_period)},
            {"id": "evening_agents", "kind": "INTEGER",
             "lower_bound": "0", "upper_bound": str(max_agents_per_period)},
        ],
        "objective": {
            "sense": "MINIMIZE",
            "terms": [
                {"variable_id": "morning_agents", "coefficient": str(m_cost)},
                {"variable_id": "evening_agents", "coefficient": str(e_cost)},
            ],
        },
        "constraints": [
            {
                "id": "minimum_morning_coverage",
                "relation": "GE",
                "terms": [
                    {"variable_id": "morning_agents", "coefficient": "2"},
                    {"variable_id": "evening_agents", "coefficient": "1"},
                ],
                "rhs": str(morning),
            },
            {
                "id": "minimum_evening_coverage",
                "relation": "GE",
                "terms": [
                    {"variable_id": "morning_agents", "coefficient": "1"},
                    {"variable_id": "evening_agents", "coefficient": "2"},
                ],
                "rhs": str(evening),
            },
        ],
    }
