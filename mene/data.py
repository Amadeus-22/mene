"""Reads a fund's inputs from CSV files. Numbers are parsed straight into Decimal."""

from __future__ import annotations

import csv
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from .model import CorporateEvent, EventKind, Flow, FlowKind, Price, Side, Trade
from .reconcile import AdminFigure


class DataError(ValueError):
    pass


@dataclass(frozen=True)
class FundData:
    name: str
    trades: list[Trade]
    prices: list[Price]
    events: list[CorporateEvent]
    flows: list[Flow]
    administrator: list[AdminFigure]


def _rows(path: Path) -> Iterator[tuple[int, dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as fh:
        yield from enumerate(csv.DictReader(fh), start=2)


def _dec(path: Path, number: int, raw: str) -> Decimal:
    try:
        return Decimal(raw)
    except InvalidOperation:
        raise DataError(f"{path.name}:{number}: {raw!r} is not a number") from None


def _day(path: Path, number: int, raw: str) -> date:
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise DataError(f"{path.name}:{number}: {raw!r} is not a YYYY-MM-DD date") from None


def load(directory: Path) -> FundData:
    d = directory
    trades = [
        Trade(
            _day(d / "trades.csv", n, r["date"]),
            r["ticker"],
            Side(r["side"]),
            _dec(d / "trades.csv", n, r["quantity"]),
            _dec(d / "trades.csv", n, r["price"]),
            _dec(d / "trades.csv", n, r["fees"]),
        )
        for n, r in _rows(d / "trades.csv")
    ]
    prices = [
        Price(_day(d / "prices.csv", n, r["date"]), r["ticker"], _dec(d / "prices.csv", n, r["close"]))
        for n, r in _rows(d / "prices.csv")
    ]
    events = [
        CorporateEvent(
            _day(d / "events.csv", n, r["date"]),
            r["ticker"],
            EventKind(r["kind"]),
            _dec(d / "events.csv", n, r["value"]),
        )
        for n, r in _rows(d / "events.csv")
    ]
    flows = [
        Flow(_day(d / "flows.csv", n, r["date"]), FlowKind(r["kind"]), _dec(d / "flows.csv", n, r["amount"]))
        for n, r in _rows(d / "flows.csv")
    ]
    administrator = [
        AdminFigure(
            _day(d / "administrator.csv", n, r["date"]), r["item"], _dec(d / "administrator.csv", n, r["value"])
        )
        for n, r in _rows(d / "administrator.csv")
    ]
    return FundData(d.name, trades, prices, events, flows, administrator)
