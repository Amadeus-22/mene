"""Writes the demo fund in data/demo/. Tickers and prices are fictional.

The administrator's file is the engine's own result with two planted breaks,
so the reconciliation screen has something real to explain:

- 2026-03-10: the administrator did not apply BETA4's 2-for-1 split.
- 2026-03-12: our price file has no GAMA3 close, so we mark it at the day before.

Run: python scripts/make_demo.py
"""

from __future__ import annotations

import csv
import random
import sys
from collections.abc import Sequence
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cota import ledger  # noqa: E402
from cota.model import (  # noqa: E402
    CorporateEvent,
    EventKind,
    Flow,
    FlowKind,
    Price,
    Side,
    Trade,
    money,
    truncate_quota,
)

OUT = ROOT / "data" / "demo"
D = date.fromisoformat
SPLIT_DAY = D("2026-03-10")
MISSING = (D("2026-03-12"), "GAMA3")


def business_days(start: date, end: date) -> list[date]:
    days, d = [], start
    while d <= end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


def fees(quantity: int, price: str) -> Decimal:
    return money(Decimal(quantity) * Decimal(price) * Decimal("0.0003"))  # 3 bps brokerage and exchange fees


def main() -> None:
    rng = random.Random(7)
    days = business_days(D("2026-03-02"), D("2026-03-13"))
    start = {"ALFA3": Decimal("32.40"), "BETA4": Decimal("45.10"), "GAMA3": Decimal("60.25")}
    prices: list[Price] = []
    level = dict(start)
    for day in days:
        for ticker in sorted(level):
            if day == SPLIT_DAY and ticker == "BETA4":
                level[ticker] = level[ticker] / 2
            step = Decimal(str(round(rng.gauss(0.0008, 0.014), 4)))
            level[ticker] = money(level[ticker] * (1 + step))
            prices.append(Price(day, ticker, level[ticker]))

    def close(day: str, ticker: str) -> str:
        return str(next(p.close for p in prices if p.day == D(day) and p.ticker == ticker))

    def trade(day: str, ticker: str, side: Side, quantity: int) -> Trade:
        price = close(day, ticker)
        return Trade(D(day), ticker, side, Decimal(quantity), Decimal(price), fees(quantity, price))

    trades = [
        trade("2026-03-03", "ALFA3", Side.BUY, 10000),
        trade("2026-03-03", "BETA4", Side.BUY, 8000),
        trade("2026-03-03", "GAMA3", Side.BUY, 5000),
        trade("2026-03-06", "ALFA3", Side.SELL, 3000),
        trade("2026-03-11", "GAMA3", Side.BUY, 1000),
    ]
    events = [
        CorporateEvent(D("2026-03-05"), "BETA4", EventKind.DIVIDEND, Decimal("0.85")),
        CorporateEvent(SPLIT_DAY, "BETA4", EventKind.SPLIT, Decimal(2)),
    ]
    flows = [
        Flow(D("2026-03-02"), FlowKind.SUBSCRIPTION, Decimal("1000000.00")),
        Flow(D("2026-03-09"), FlowKind.REDEMPTION, Decimal("50000.00")),
        Flow(D("2026-03-11"), FlowKind.SUBSCRIPTION, Decimal("120000.00")),
    ]

    truth = ledger.run(trades, prices, events, flows)
    admin: list[tuple[str, str, str]] = []
    for day, s in truth.items():
        nav, quota = s.net_asset_value, s.quota
        quantities = {p.ticker: p.quantity for p in s.positions}
        if day == SPLIT_DAY:
            beta = next(p for p in s.positions if p.ticker == "BETA4")
            quantities["BETA4"] = beta.quantity / 2
            nav = money(nav - beta.quantity / 2 * beta.price)
            quota = truncate_quota(nav / s.shares_outstanding)
        admin += [(day.isoformat(), "QUOTA", str(quota)), (day.isoformat(), "NAV", str(nav))]
        admin += [(day.isoformat(), f"POSITION:{t}", str(q)) for t, q in sorted(quantities.items())]

    OUT.mkdir(parents=True, exist_ok=True)
    write(
        "trades.csv",
        ["date", "ticker", "side", "quantity", "price", "fees"],
        [(t.day, t.ticker, t.side.value, t.quantity, t.price, t.fees) for t in trades],
    )
    write(
        "prices.csv",
        ["date", "ticker", "close"],
        [(p.day, p.ticker, p.close) for p in prices if (p.day, p.ticker) != MISSING],
    )
    write("events.csv", ["date", "ticker", "kind", "value"], [(e.day, e.ticker, e.kind.value, e.value) for e in events])
    write("flows.csv", ["date", "kind", "amount"], [(f.day, f.kind.value, f.amount) for f in flows])
    write("administrator.csv", ["date", "item", "value"], admin)


def write(name: str, header: list[str], rows: Sequence[tuple[object, ...]]) -> None:
    with (OUT / name).open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


if __name__ == "__main__":
    main()
