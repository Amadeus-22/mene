"""Daily portfolio and quota calculation for one fund.

Order of operations on each day D:

1. Corporate events with ex-date D (splits adjust quantity and average cost,
   dividends credit cash).
2. Trades of D (buys update the average cost, sells realize profit or loss).
3. Mark every position to D's close. A missing close falls back to the last
   known one and the position is flagged as stale.
4. Net asset value (PL) = cash + market value, before D's investor flows.
   Quota = PL / shares outstanding, truncated to 8 places. The first quota is 1.
5. Subscriptions and redemptions of D are converted at D's quota.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from .model import (
    CorporateEvent,
    EventKind,
    Flow,
    FlowKind,
    Position,
    Price,
    Side,
    Snapshot,
    Trade,
    br,
    br_date,
    money,
    truncate_quota,
    truncate_shares,
)

INITIAL_QUOTA = Decimal("1.00000000")


class LedgerError(ValueError):
    """The inputs describe something the fund cannot do, such as selling more than it holds."""


@dataclass
class _Holding:
    quantity: Decimal = Decimal(0)
    average_cost: Decimal = Decimal(0)


def run(
    trades: Iterable[Trade],
    prices: Iterable[Price],
    events: Iterable[CorporateEvent],
    flows: Iterable[Flow],
) -> dict[date, Snapshot]:
    """Replays every input in date order and returns one snapshot per day with activity or a price."""
    by_day_trades: dict[date, list[Trade]] = defaultdict(list)
    by_day_events: dict[date, list[CorporateEvent]] = defaultdict(list)
    by_day_flows: dict[date, list[Flow]] = defaultdict(list)
    closes: dict[date, dict[str, Decimal]] = defaultdict(dict)
    for t in trades:
        by_day_trades[t.day].append(t)
    for e in events:
        by_day_events[e.day].append(e)
    for f in flows:
        by_day_flows[f.day].append(f)
    for p in prices:
        closes[p.day][p.ticker] = p.close

    days = sorted(set(by_day_trades) | set(by_day_events) | set(by_day_flows) | set(closes))
    holdings: dict[str, _Holding] = {}
    last_close: dict[str, Decimal] = {}
    cash = Decimal(0)
    shares = Decimal(0)
    realized = Decimal(0)
    snapshots: dict[date, Snapshot] = {}

    for day in days:
        notes: list[str] = []

        for event in by_day_events[day]:
            holding = holdings.get(event.ticker)
            if holding is None or holding.quantity == 0:
                continue
            if event.kind is EventKind.SPLIT:
                holding.quantity *= event.value
                holding.average_cost /= event.value
                last_close.pop(event.ticker, None)  # a pre-split close is no longer comparable
                notes.append(f"{event.ticker}: desdobramento de {br(event.value)} para 1")
            else:
                amount = money(holding.quantity * event.value)
                cash += amount
                notes.append(
                    f"{event.ticker}: dividendo de R$ {br(event.value)} por ação, R$ {br(amount)} creditados no caixa"
                )

        for trade in by_day_trades[day]:
            holding = holdings.setdefault(trade.ticker, _Holding())
            gross = trade.quantity * trade.price
            if trade.side is Side.BUY:
                cost = holding.quantity * holding.average_cost + gross + trade.fees
                holding.quantity += trade.quantity
                holding.average_cost = cost / holding.quantity
                cash -= money(gross + trade.fees)
            else:
                if trade.quantity > holding.quantity:
                    raise LedgerError(
                        f"{day}: selling {trade.quantity} {trade.ticker} but the fund holds {holding.quantity}"
                    )
                realized += money(trade.quantity * (trade.price - holding.average_cost) - trade.fees)
                holding.quantity -= trade.quantity
                cash += money(gross - trade.fees)
                if holding.quantity == 0:
                    holding.average_cost = Decimal(0)

        positions: list[Position] = []
        for ticker in sorted(holdings):
            holding = holdings[ticker]
            if holding.quantity == 0:
                continue
            close = closes[day].get(ticker)
            stale = close is None
            if close is None:
                close = last_close.get(ticker)
                if close is None:
                    raise LedgerError(
                        f"{day}: no price for {ticker} on this day or any earlier day since the last split"
                    )
                notes.append(
                    f"{ticker}: sem fechamento em {br_date(day)}, marcado pelo fechamento anterior R$ {br(close)}"
                )
            last_close[ticker] = close
            positions.append(Position(ticker, holding.quantity, holding.average_cost, close, stale))

        nav = money(cash + sum((p.market_value for p in positions), Decimal(0)))
        quota = truncate_quota(nav / shares) if shares > 0 else INITIAL_QUOTA

        for flow in by_day_flows[day]:
            issued = truncate_shares(flow.amount / quota)
            if flow.kind is FlowKind.SUBSCRIPTION:
                shares += issued
                cash += flow.amount
            else:
                if issued > shares:
                    raise LedgerError(f"{day}: redeeming {issued} shares but only {shares} are outstanding")
                shares -= issued
                cash -= flow.amount

        snapshots[day] = Snapshot(
            day=day,
            positions=tuple(positions),
            cash=money(cash),
            net_asset_value=nav,
            quota=quota,
            shares_outstanding=shares,
            realized_pnl=realized,
            notes=tuple(notes),
        )

    return snapshots
