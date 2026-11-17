"""HTTP API for the web app. Decimals travel as strings so no precision is lost in JSON."""

from __future__ import annotations

import os
from datetime import date
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from . import ledger
from .data import FundData, load
from .model import Snapshot
from .reconcile import reconcile

DATA_DIR = Path(os.environ.get("COTA_DATA_DIR", Path(__file__).resolve().parent.parent / "data" / "demo"))
WEB_DIR = os.environ.get("COTA_WEB_DIR")

app = FastAPI(title="cota", version="0.1.0")


@lru_cache(maxsize=1)
def _fund() -> tuple[FundData, dict[date, Snapshot]]:
    data = load(DATA_DIR)
    return data, ledger.run(data.trades, data.prices, data.events, data.flows)


def _s(value: Decimal | None) -> str | None:
    return None if value is None else str(value)


def _snapshot(day: date) -> Snapshot:
    snapshots = _fund()[1]
    if day not in snapshots:
        raise HTTPException(404, f"no calculation for {day}")
    return snapshots[day]


@app.get("/api/days")
def days() -> dict[str, Any]:
    data, snapshots = _fund()
    ordered = sorted(snapshots)
    out = []
    for i, d in enumerate(ordered):
        s = snapshots[d]
        previous = snapshots[ordered[i - 1]].quota if i else None
        change = None if previous is None else (s.quota / previous - 1) * 100
        report = reconcile(s, data.administrator, data.events)
        out.append(
            {
                "date": d.isoformat(),
                "quota": _s(s.quota),
                "change_pct": None if change is None else f"{change:.4f}",
                "reconciled": report.matched,
            }
        )
    return {"fund": data.name, "days": out}


@app.get("/api/portfolio/{day}")
def portfolio(day: date) -> dict[str, Any]:
    s = _snapshot(day)
    return {
        "date": s.day.isoformat(),
        "quota": _s(s.quota),
        "net_asset_value": _s(s.net_asset_value),
        "closing_net_asset_value": _s(s.closing_net_asset_value),
        "cash": _s(s.cash),
        "shares_outstanding": _s(s.shares_outstanding),
        "realized_pnl": _s(s.realized_pnl),
        "notes": list(s.notes),
        "positions": [
            {
                "ticker": p.ticker,
                "quantity": _s(p.quantity),
                "average_cost": _s(p.average_cost.quantize(Decimal("0.0001"))),
                "price": _s(p.price),
                "market_value": _s(p.market_value),
                "unrealized_pnl": _s(p.unrealized_pnl),
                "stale_price": p.stale_price,
            }
            for p in s.positions
        ],
    }


@app.get("/api/reconciliation/{day}")
def reconciliation(day: date) -> dict[str, Any]:
    data, _ = _fund()
    report = reconcile(_snapshot(day), data.administrator, data.events)
    return {
        "date": report.day.isoformat(),
        "matched": report.matched,
        "lines": [
            {
                "item": line.item,
                "ours": _s(line.ours),
                "theirs": _s(line.theirs),
                "difference": _s(line.difference),
                "status": line.status.value,
            }
            for line in report.lines
        ],
        "causes": list(report.causes),
    }


if WEB_DIR:
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
