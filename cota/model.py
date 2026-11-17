"""Inputs and outputs of the daily fund calculation.

Every amount is a Decimal. Floats never touch money: 0.1 + 0.2 is not 0.3 in
binary floating point, and a fund's quota is compared to the administrator's to
the eighth decimal place.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_DOWN, ROUND_HALF_EVEN, Decimal
from enum import StrEnum

CENT = Decimal("0.01")
QUOTA_PLACES = Decimal("0.00000001")  # 8 decimal places
SHARE_PLACES = Decimal("0.00000001")


def money(value: Decimal) -> Decimal:
    """Rounds a currency amount to cents, half to even (banker's rounding)."""
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)


def truncate_quota(value: Decimal) -> Decimal:
    """Truncates the quota to 8 places, the usual convention for Brazilian funds."""
    return value.quantize(QUOTA_PLACES, rounding=ROUND_DOWN)


def truncate_shares(value: Decimal) -> Decimal:
    return value.quantize(SHARE_PLACES, rounding=ROUND_DOWN)


class Side(StrEnum):
    BUY = "BUY"
    SELL = "SELL"


class EventKind(StrEnum):
    SPLIT = "SPLIT"  # value = new shares per old share (2 means 1 becomes 2)
    DIVIDEND = "DIVIDEND"  # value = cash per share, credited on the ex-date


class FlowKind(StrEnum):
    SUBSCRIPTION = "SUBSCRIPTION"  # aplicação
    REDEMPTION = "REDEMPTION"  # resgate


@dataclass(frozen=True)
class Trade:
    day: date
    ticker: str
    side: Side
    quantity: Decimal
    price: Decimal
    fees: Decimal = Decimal(0)


@dataclass(frozen=True)
class Price:
    day: date
    ticker: str
    close: Decimal


@dataclass(frozen=True)
class CorporateEvent:
    day: date
    ticker: str
    kind: EventKind
    value: Decimal


@dataclass(frozen=True)
class Flow:
    day: date
    kind: FlowKind
    amount: Decimal


@dataclass(frozen=True)
class Position:
    ticker: str
    quantity: Decimal
    average_cost: Decimal  # per share, fees included
    price: Decimal  # close used to mark the position
    stale_price: bool  # True when the day's close was missing and an older one was used

    @property
    def market_value(self) -> Decimal:
        return money(self.quantity * self.price)

    @property
    def unrealized_pnl(self) -> Decimal:
        return money(self.quantity * (self.price - self.average_cost))


@dataclass(frozen=True)
class Snapshot:
    """The fund at the close of one day, after that day's flows."""

    day: date
    positions: tuple[Position, ...]
    cash: Decimal
    net_asset_value: Decimal  # PL before the day's flows: what the quota is computed on
    quota: Decimal
    shares_outstanding: Decimal  # after the day's flows
    realized_pnl: Decimal  # accumulated since inception
    notes: tuple[str, ...] = field(default=())

    @property
    def closing_net_asset_value(self) -> Decimal:
        return money(self.cash + sum((p.market_value for p in self.positions), Decimal(0)))


def br(value: Decimal) -> str:
    """Brazilian notation for messages shown to people: 1.234,56."""
    sign = "-" if value < 0 else ""
    integer, _, fraction = f"{abs(value):f}".partition(".")
    grouped = f"{int(integer):,}".replace(",", ".")
    return f"{sign}{grouped}{',' + fraction if fraction else ''}"


def br_date(day: date) -> str:
    return day.strftime("%d/%m/%Y")
