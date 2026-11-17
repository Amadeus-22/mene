"""HTTP API for the web app. Decimals travel as strings so no precision is lost in JSON."""

from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import date
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from . import ledger, mirror
from .data import FundData, load
from .model import FlowKind, Snapshot, money
from .reconcile import reconcile

DATA_DIR = Path(os.environ.get("MENE_DATA_DIR", Path(__file__).resolve().parent.parent / "data" / "demo"))
WEB_DIR = os.environ.get("MENE_WEB_DIR")
REAL_DIR = Path(os.environ.get("MENE_REAL_DIR", Path(__file__).resolve().parent.parent / "data" / "real"))

app = FastAPI(title="Mene", version="0.2.0")


@lru_cache(maxsize=1)
def _fund() -> tuple[FundData, dict[date, Snapshot]]:
    data = load(DATA_DIR)
    return data, ledger.run(data.trades, data.prices, data.events, data.flows)


def _s(value: Decimal | None) -> str | None:
    """Plain notation: str(Decimal("0E-8")) would print the exponent."""
    return None if value is None else format(value, "f")


def _snapshot(day: date) -> Snapshot:
    snapshots = _fund()[1]
    if day not in snapshots:
        raise HTTPException(404, f"no calculation for {day}")
    return snapshots[day]


@app.get("/api/fund")
def fund() -> dict[str, Any]:
    info: dict[str, Any] = json.loads((DATA_DIR / "fund.json").read_text(encoding="utf-8"))
    return info


@app.get("/api/days")
def days() -> dict[str, Any]:
    data, snapshots = _fund()
    ordered = sorted(snapshots)
    first = snapshots[ordered[0]].quota if ordered else Decimal(1)
    flows: dict[tuple[date, FlowKind], Decimal] = defaultdict(Decimal)
    for f in data.flows:
        flows[(f.day, f.kind)] += f.amount
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
                "return_pct": f"{(s.quota / first - 1) * 100:.4f}",
                "net_asset_value": _s(s.net_asset_value),
                "closing_net_asset_value": _s(s.closing_net_asset_value),
                "subscriptions": _s(money(flows[(d, FlowKind.SUBSCRIPTION)])),
                "redemptions": _s(money(flows[(d, FlowKind.REDEMPTION)])),
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


@lru_cache(maxsize=8)
def _mirror(slug: str) -> tuple[dict[str, object], mirror.Mirror]:
    directory = REAL_DIR / slug
    if not slug.replace("-", "").isalnum() or not (directory / "fund.json").exists():
        raise HTTPException(404, f"no extract for {slug}; run scripts/fetch_real.py")
    return mirror.load(directory)


@app.get("/api/real")
def real_funds() -> dict[str, Any]:
    funds = []
    for d in sorted(REAL_DIR.glob("*/fund.json")) if REAL_DIR.exists() else []:
        info, m = _mirror(d.parent.name)
        last = m.days[-1] if m.days else None
        funds.append(
            {
                "slug": d.parent.name,
                "name": info["name"],
                "cnpj": info["cnpj"],
                "last_date": None if last is None else last.day.isoformat(),
                "official_quota": None if last is None else _s(last.official_quota),
                "net_asset_value": None if last is None else _s(last.official_nav),
                "gap_bps": None if last is None else _s(last.gap_bps),
                "flagged_days": sum(1 for x in m.days if x.flagged),
            }
        )
    return {"funds": funds}


@app.get("/api/real/{slug}")
def real_fund(slug: str) -> dict[str, Any]:
    info, m = _mirror(slug)
    first = m.days[0].official_quota if m.days else None
    return {
        "info": info,
        "start": m.start.isoformat(),
        "start_nav": _s(money(m.start_nav)),
        "shares": _s(m.shares.quantize(Decimal("0.01"))),
        "other_assets": _s(m.other_assets),
        "check": {
            "stocks": len(m.checks),
            "ours": _s(m.stock_value_ours),
            "administrator": _s(m.stock_value_administrator),
            "mismatches": [
                {"ticker": c.ticker, "difference": _s(c.difference)}
                for c in m.checks
                if c.difference is None or c.difference != 0
            ],
        },
        "holdings": [
            {
                "ticker": c.ticker,
                "quantity": _s(c.quantity),
                "close": _s(c.close),
                "market_value": _s(c.administrator),
                "weight_pct": f"{c.administrator / m.start_nav * 100:.2f}",
            }
            for c in sorted(m.checks, key=lambda c: c.administrator, reverse=True)
        ],
        "days": [
            {
                "date": d.day.isoformat(),
                "official_quota": _s(d.official_quota),
                "our_quota": _s(d.our_quota),
                "official_return_pct": None if first is None else f"{(d.official_quota / first - 1) * 100:.4f}",
                "our_return_pct": None if first is None else f"{(d.our_quota / first - 1) * 100:.4f}",
                "gap_bps": _s(d.gap_bps),
                "gap_change_bps": _s(d.gap_change_bps),
                "net_asset_value": _s(d.official_nav),
                "subscriptions": _s(d.subscriptions),
                "redemptions": _s(d.redemptions),
                "holders": d.holders,
                "stale": list(d.stale),
                "flagged": d.flagged,
                "explanation": d.explanation,
                "movers": [
                    {
                        "ticker": x.ticker,
                        "return_pct": f"{x.return_pct:.2f}",
                        "contribution_bps": f"{x.contribution_bps:.2f}",
                    }
                    for x in d.movers
                ],
            }
            for d in m.days
        ],
    }


if WEB_DIR:
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
