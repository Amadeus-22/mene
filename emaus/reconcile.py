"""Daily reconciliation against the fund administrator's figures.

The administrator calculates the official quota independently. Each day the
manager compares its own numbers with the administrator's: the quota, the net
asset value and every position. A difference is not resolved by picking one
side; it is explained, and the explanation says which side has to fix what.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum

from .model import CorporateEvent, EventKind, Snapshot, br, br_date

QUOTA_TOLERANCE = Decimal("0.00000001")
NAV_TOLERANCE = Decimal("0.01")


@dataclass(frozen=True)
class AdminFigure:
    day: date
    item: str  # QUOTA, NAV or POSITION:<ticker>
    value: Decimal


class Status(StrEnum):
    MATCH = "match"
    BREAK = "break"
    MISSING = "missing"  # one side has the item, the other does not


@dataclass(frozen=True)
class Line:
    item: str
    ours: Decimal | None
    theirs: Decimal | None
    status: Status

    @property
    def difference(self) -> Decimal | None:
        if self.ours is None or self.theirs is None:
            return None
        return self.ours - self.theirs


@dataclass(frozen=True)
class Report:
    day: date
    lines: tuple[Line, ...]
    causes: tuple[str, ...]

    @property
    def matched(self) -> bool:
        return all(line.status is Status.MATCH for line in self.lines)


def reconcile(snapshot: Snapshot, figures: Iterable[AdminFigure], events: Iterable[CorporateEvent]) -> Report:
    theirs = {f.item: f.value for f in figures if f.day == snapshot.day}
    ours: dict[str, Decimal] = {"QUOTA": snapshot.quota, "NAV": snapshot.net_asset_value}
    for position in snapshot.positions:
        ours[f"POSITION:{position.ticker}"] = position.quantity

    lines: list[Line] = []
    for item in sorted(set(ours) | set(theirs), key=_order):
        a, b = ours.get(item), theirs.get(item)
        if a is None or b is None:
            status = Status.MISSING
        else:
            tolerance = QUOTA_TOLERANCE if item == "QUOTA" else NAV_TOLERANCE if item == "NAV" else Decimal(0)
            status = Status.MATCH if abs(a - b) <= tolerance else Status.BREAK
        lines.append(Line(item, a, b, status))

    return Report(snapshot.day, tuple(lines), tuple(_explain(snapshot, lines, list(events))))


def _order(item: str) -> tuple[int, str]:
    return ({"QUOTA": 0, "NAV": 1}.get(item, 2), item)


def _explain(snapshot: Snapshot, lines: list[Line], events: list[CorporateEvent]) -> list[str]:
    """Names the likely cause of each break, from the evidence available on our side."""
    if all(line.status is Status.MATCH for line in lines):
        return []
    causes: list[str] = []
    today = [e for e in events if e.day == snapshot.day]
    for line in lines:
        if line.status is not Status.BREAK or not line.item.startswith("POSITION:"):
            continue
        ticker = line.item.split(":", 1)[1]
        assert line.ours is not None and line.theirs is not None
        for event in today:
            if event.ticker == ticker and event.kind is EventKind.SPLIT and line.theirs * event.value == line.ours:
                causes.append(
                    f"{ticker}: a quantidade do administrador é a nossa antes do desdobramento de "
                    f"{br(event.value)} para 1 com data ex {br_date(event.day)}. O desdobramento não foi "
                    "aplicado do lado deles: pedir que apliquem."
                )
                break
        else:
            causes.append(
                f"{ticker}: quantities differ by {line.ours - line.theirs}; check the day's trades on both sides."
            )

    for position in snapshot.positions:
        if position.stale_price:
            causes.append(
                f"{position.ticker}: não tínhamos o fechamento de {br_date(snapshot.day)} e marcamos pelo anterior, "
                f"R$ {br(position.price)}. O preço falta do nosso lado: carregar o fechamento do dia e recalcular."
            )

    if not causes:
        causes.append("As posições batem, mas o valor difere: comparar preços, caixa e provisões linha a linha.")
    return causes
