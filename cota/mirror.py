"""Mirror quota ("cota espelho") of a real fund from public data.

We do not see the fund's trades, so we hold its last disclosed portfolio (CVM
CDA, month end) fixed, price it every day with B3 closes, grow the non-stock
part (cash, receivables, payables) at the CDI, and divide by the shares
outstanding implied on the CDA date. The result is compared with the official
quota the administrator published to the CVM.

The gap is information, not an error to hide: a steady negative drift is the
fees we do not deduct; a jump on one day points to an event our model does not
see (a dividend's ex-date, a rebalance, a corporate action).

Order of checks:

1. Pipeline check on the CDA date: our price x quantity must match the
   administrator's own market value for every stock. If it does not, nothing
   after it can be trusted.
2. Daily mirror quota and its gap to the official quota, in basis points.
3. Days whose gap moved more than ``JUMP_BPS`` are flagged with the stocks
   that moved most that day, as the first places to look.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

from .model import br, money, truncate_quota
from .sources import Holding, OfficialDay

BPS = Decimal(10000)
JUMP_BPS = Decimal(3)


@dataclass(frozen=True)
class StockCheck:
    ticker: str
    quantity: Decimal
    close: Decimal | None
    ours: Decimal | None
    administrator: Decimal

    @property
    def difference(self) -> Decimal | None:
        return None if self.ours is None else self.ours - self.administrator


@dataclass(frozen=True)
class Mover:
    ticker: str
    return_pct: Decimal
    contribution_bps: Decimal


@dataclass(frozen=True)
class MirrorDay:
    day: date
    official_quota: Decimal
    our_quota: Decimal
    gap_bps: Decimal
    gap_change_bps: Decimal | None
    official_nav: Decimal
    subscriptions: Decimal
    redemptions: Decimal
    holders: int
    stale: tuple[str, ...]
    movers: tuple[Mover, ...]  # filled on flagged days

    @property
    def flagged(self) -> bool:
        return self.gap_change_bps is not None and abs(self.gap_change_bps) > JUMP_BPS

    @property
    def explanation(self) -> str | None:
        """Where to look first when the gap jumps; the data cannot prove the cause."""
        if not self.flagged or self.gap_change_bps is None:
            return None
        if self.gap_change_bps < 0:
            return (
                f"A nossa cota caiu {br(abs(self.gap_change_bps))} bps em relação à oficial. "
                "É o padrão de uma data ex de "
                "dividendos ou JCP: o preço cai e o fundo registra o valor a receber, "
                "que a carteira pública não mostra. "
                "Conferir os eventos com data ex no dia."
            )
        return (
            f"A nossa cota subiu {br(self.gap_change_bps)} bps em relação à oficial. Pode ser uma troca de carteira "
            "(rebalanceamento do índice) ou uma provisão do fundo. Conferir as movimentações do dia."
        )


@dataclass(frozen=True)
class Mirror:
    start: date
    start_nav: Decimal
    shares: Decimal
    other_assets: Decimal
    checks: tuple[StockCheck, ...]
    days: tuple[MirrorDay, ...]

    @property
    def stock_value_ours(self) -> Decimal:
        return sum((c.ours for c in self.checks if c.ours is not None), Decimal(0))

    @property
    def stock_value_administrator(self) -> Decimal:
        return sum((c.administrator for c in self.checks), Decimal(0))


def build(
    holdings: list[Holding],
    start: date,
    start_nav: Decimal,
    official: list[OfficialDay],
    closes: dict[tuple[date, str], Decimal],
    cdi: dict[date, Decimal],
) -> Mirror:
    by_day = {d.day: d for d in official}
    if start not in by_day:
        raise ValueError(f"no official quota on the CDA date {start}")
    shares = start_nav / by_day[start].quota
    stock_admin = sum((h.market_value for h in holdings), Decimal(0))
    other_start = start_nav - stock_admin
    other = other_start

    checks = []
    for h in holdings:
        close = closes.get((start, h.ticker))
        checks.append(
            StockCheck(
                h.ticker, h.quantity, close, None if close is None else money(h.quantity * close), h.market_value
            )
        )

    last: dict[str, Decimal] = {h.ticker: closes[(start, h.ticker)] for h in holdings if (start, h.ticker) in closes}
    days: list[MirrorDay] = []
    previous_gap: Decimal | None = None
    previous_value: Decimal | None = None
    for official_day in [d for d in official if d.day > start]:
        day = official_day.day
        other *= 1 + cdi.get(day, Decimal(0)) / 100
        stale = []
        value = Decimal(0)
        today: dict[str, Decimal] = {}
        for h in holdings:
            close = closes.get((day, h.ticker))
            if close is None:
                close = last.get(h.ticker)
                stale.append(h.ticker)
            if close is None:
                continue
            today[h.ticker] = close
            value += h.quantity * close
        ours = truncate_quota((value + other) / shares)
        gap = (ours / official_day.quota - 1) * BPS
        change = None if previous_gap is None else gap - previous_gap

        movers: tuple[Mover, ...] = ()
        if change is not None and abs(change) > JUMP_BPS and previous_value:
            ranked = sorted(
                (
                    Mover(
                        h.ticker,
                        ((today[h.ticker] / last[h.ticker]) - 1) * 100,
                        h.quantity * (today[h.ticker] - last[h.ticker]) / previous_value * BPS,
                    )
                    for h in holdings
                    if h.ticker in today and h.ticker in last
                ),
                key=lambda m: abs(m.contribution_bps),
                reverse=True,
            )
            movers = tuple(ranked[:3])

        days.append(
            MirrorDay(
                day,
                official_day.quota,
                ours,
                gap.quantize(Decimal("0.01")),
                None if change is None else change.quantize(Decimal("0.01")),
                official_day.net_asset_value,
                official_day.subscriptions,
                official_day.redemptions,
                official_day.holders,
                tuple(stale),
                movers,
            )
        )
        last.update(today)
        previous_gap = gap
        previous_value = value + other

    return Mirror(start, start_nav, shares, other_start, tuple(checks), tuple(days))


def load(directory: Path) -> tuple[dict[str, object], Mirror]:
    """Reads the extract written by scripts/fetch_real.py and builds the mirror."""
    info: dict[str, object] = json.loads((directory / "fund.json").read_text(encoding="utf-8"))

    def rows(name: str) -> list[dict[str, str]]:
        with (directory / name).open(newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))

    holdings = [Holding(r["ticker"], Decimal(r["quantity"]), Decimal(r["market_value"])) for r in rows("holdings.csv")]
    official = [
        OfficialDay(
            date.fromisoformat(r["date"]),
            Decimal(r["quota"]),
            Decimal(r["net_asset_value"]),
            Decimal(r["subscriptions"]),
            Decimal(r["redemptions"]),
            int(r["holders"]),
        )
        for r in rows("official.csv")
    ]
    closes = {(date.fromisoformat(r["date"]), r["ticker"]): Decimal(r["close"]) for r in rows("closes.csv")}
    cdi = {date.fromisoformat(r["date"]): Decimal(r["rate_pct"]) for r in rows("cdi.csv")}
    start = date.fromisoformat(str(info["portfolio_date"]))
    return info, build(holdings, start, Decimal(str(info["net_asset_value"])), official, closes, cdi)
