"""Remote demo A: select repair jobs under a bounded crew-hour budget.

Outputs a DecisionSpec only. The QDIP Server owns optimization and replay.
"""
from __future__ import annotations

import re
from typing import Any


def _bounded_int(value: Any, name: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{name} must be an integer in [{low}, {high}]")
    return value


def make_spec(payload: dict[str, Any], decision_id: str) -> dict[str, Any]:
    if set(payload) != {"capacity_hours", "jobs"}:
        raise ValueError("Expected capacity_hours and jobs only")
    capacity = _bounded_int(payload["capacity_hours"], "capacity_hours", 0, 100)
    jobs = payload["jobs"]
    if not isinstance(jobs, list) or not 1 <= len(jobs) <= 8:
        raise ValueError("jobs must contain 1..8 items")

    variables: list[dict[str, Any]] = []
    objective_terms: list[dict[str, str]] = []
    capacity_terms: list[dict[str, str]] = []
    names: set[str] = set()
    for job in jobs:
        if not isinstance(job, dict) or set(job) != {"id", "hours", "priority"}:
            raise ValueError("Each job requires id, hours and priority")
        name = job["id"]
        if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,15}", name):
            raise ValueError("Invalid job id")
        if name in names:
            raise ValueError("Duplicate job id")
        names.add(name)
        hours = _bounded_int(job["hours"], "hours", 1, 100)
        priority = _bounded_int(job["priority"], "priority", 0, 100)
        var = f"job_{name}"
        variables.append({"id": var, "kind": "BOOLEAN"})
        objective_terms.append({"variable_id": var, "coefficient": str(priority)})
        capacity_terms.append({"variable_id": var, "coefficient": str(hours)})

    return {
        "semantic_version": "1.0.0",
        "decision_id": decision_id,
        "variables": variables,
        "objective": {"sense": "MAXIMIZE", "terms": objective_terms},
        "constraints": [{
            "id": "crew_hour_budget",
            "relation": "LE",
            "terms": capacity_terms,
            "rhs": str(capacity),
        }],
    }
