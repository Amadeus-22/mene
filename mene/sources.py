"""Parsers for the official open data the mirror quota uses.

- CVM CDA (monthly portfolio of every fund): ``cda_fi_BLC_4`` holds listed
  stocks, ``cda_fi_PL`` the net asset value on the same date.
- CVM informe diário: each fund's official quota, PL and flows per day.
- B3 COTAHIST: fixed-width file with every instrument's daily prices.
- Banco Central SGS series 12: the daily CDI rate.

Every number is parsed straight into Decimal.
"""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class Holding:
    ticker: str
    quantity: Decimal
    market_value: Decimal  # as reported by the administrator in the CDA


@dataclass(frozen=True)
class OfficialDay:
    day: date
    quota: Decimal
    net_asset_value: Decimal
    subscriptions: Decimal
    redemptions: Decimal
    holders: int


def _csv(lines: Iterable[str]) -> Iterator[dict[str, str]]:
    return csv.DictReader(lines, delimiter=";")


def cda_stocks(lines: Iterable[str], cnpj: str) -> list[Holding]:
    """Listed stocks of one fund from ``cda_fi_BLC_4``; repeated tickers are summed."""
    totals: dict[str, tuple[Decimal, Decimal]] = {}
    for r in _csv(lines):
        if r["CNPJ_FUNDO_CLASSE"] != cnpj or not r["CD_ATIVO"]:
            continue
        q, v = totals.get(r["CD_ATIVO"], (Decimal(0), Decimal(0)))
        totals[r["CD_ATIVO"]] = (q + Decimal(r["QT_POS_FINAL"]), v + Decimal(r["VL_MERC_POS_FINAL"]))
    return [Holding(t, q, v) for t, (q, v) in sorted(totals.items())]


def cda_net_asset_value(lines: Iterable[str], cnpj: str) -> tuple[date, Decimal]:
    for r in _csv(lines):
        if r["CNPJ_FUNDO_CLASSE"] == cnpj:
            return date.fromisoformat(r["DT_COMPTC"]), Decimal(r["VL_PATRIM_LIQ"])
    raise LookupError(f"{cnpj} not in the CDA PL file")


def daily_reports(lines: Iterable[str], cnpj: str) -> list[OfficialDay]:
    out = []
    for r in _csv(lines):
        if r["CNPJ_FUNDO_CLASSE"] != cnpj or r.get("ID_SUBCLASSE"):
            continue
        out.append(
            OfficialDay(
                date.fromisoformat(r["DT_COMPTC"]),
                Decimal(r["VL_QUOTA"]),
                Decimal(r["VL_PATRIM_LIQ"]),
                Decimal(r["CAPTC_DIA"]),
                Decimal(r["RESG_DIA"]),
                int(r["NR_COTST"]),
            )
        )
    return sorted(out, key=lambda d: d.day)


def cotahist_closes(lines: Iterable[str], tickers: set[str]) -> dict[tuple[date, str], Decimal]:
    """Closing prices of the cash market (TPMERC 010) for the given tickers.

    Layout (B3 SerHistCotacoes): TIPREG 1-2, DATPRE 3-10, CODNEG 13-24,
    TPMERC 25-27, PREULT 109-121 with two implied decimals, FATCOT 211-217.
    """
    closes: dict[tuple[date, str], Decimal] = {}
    for line in lines:
        if not line.startswith("01") or line[24:27] != "010":
            continue
        ticker = line[12:24].strip()
        if ticker not in tickers:
            continue
        day = date(int(line[2:6]), int(line[6:8]), int(line[8:10]))
        factor = Decimal(int(line[210:217]))
        closes[(day, ticker)] = Decimal(int(line[108:121])) / 100 / factor
    return closes


def sgs_rates(payload: list[dict[str, str]]) -> dict[date, Decimal]:
    """SGS JSON (``[{"data": "dd/mm/yyyy", "valor": "0.050788"}]``) as daily rates in percent."""
    out = {}
    for item in payload:
        d, m, y = item["data"].split("/")
        out[date(int(y), int(m), int(d))] = Decimal(item["valor"])
    return out


def text_lines(raw: bytes) -> io.StringIO:
    """CVM and B3 files are Latin-1."""
    return io.StringIO(raw.decode("latin-1"))
