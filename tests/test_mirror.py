from datetime import date
from decimal import Decimal

from mene import mirror, sources
from mene.sources import Holding, OfficialDay

X = Decimal
D0, D1, D2 = date(2026, 9, 30), date(2026, 10, 1), date(2026, 10, 2)


def official(day: date, quota: str) -> OfficialDay:
    return OfficialDay(day, X(quota), X(0), X(0), X(0), 1)


def test_cotahist_fixed_width_close_with_quote_factor() -> None:
    line = "01" + "20261001" + "02" + "PETR4".ljust(12) + "010" + " " * 81 + "0000000003512" + " " * 89 + "0000001"
    assert len(line) >= 217
    assert sources.cotahist_closes([line, "00header"], {"PETR4"}) == {(D1, "PETR4"): X("35.12")}


def test_sgs_rates_parse_brazilian_dates() -> None:
    assert sources.sgs_rates([{"data": "01/10/2026", "valor": "0.050788"}]) == {D1: X("0.050788")}


def test_mirror_checks_the_pipeline_then_tracks_the_official_quota() -> None:
    holdings = [Holding("AAAA3", X(100), X("1000.00")), Holding("BBBB4", X(50), X("1000.00"))]
    closes = {
        (D0, "AAAA3"): X("10.00"),
        (D0, "BBBB4"): X("20.00"),
        (D1, "AAAA3"): X("11.00"),
        (D1, "BBBB4"): X("20.00"),
        (D2, "AAAA3"): X("11.00"),
        (D2, "BBBB4"): X("19.00"),
    }
    # PL 2500 = 2000 in stocks + 500 in cash; quota 2 -> 1250 shares
    m = mirror.build(
        holdings, D0, X("2500.00"), [official(D0, "2"), official(D1, "2.08"), official(D2, "2.06")], closes, {}
    )
    assert all(c.difference == 0 for c in m.checks)
    assert m.shares == 1250 and m.other_assets == 500
    first, second = m.days
    assert first.our_quota == X("2.08000000") and first.gap_bps == 0  # (1100 + 1000 + 500) / 1250
    assert second.our_quota == X("2.04000000")  # BBBB4 fell 1, 50 x 1 / 1250 = 0.04
    assert second.gap_bps == X("-97.09") and second.flagged
    assert second.movers[0].ticker == "BBBB4"
    assert second.explanation is not None and "data ex" in second.explanation


def test_missing_close_uses_the_previous_one_and_is_reported() -> None:
    holdings = [Holding("AAAA3", X(100), X("1000.00"))]
    closes = {(D0, "AAAA3"): X("10.00")}
    m = mirror.build(holdings, D0, X("1000.00"), [official(D0, "1"), official(D1, "1")], closes, {})
    assert m.days[0].stale == ("AAAA3",) and m.days[0].gap_bps == 0


def test_cash_grows_at_the_cdi() -> None:
    m = mirror.build([], D0, X("1000.00"), [official(D0, "1"), official(D1, "1.0005")], {}, {D1: X("0.05")})
    assert m.days[0].our_quota == X("1.00050000")
