from datetime import date
from decimal import Decimal

import pytest

from emaus import ledger
from emaus.model import CorporateEvent, EventKind, Flow, FlowKind, Price, Side, Trade, money, truncate_quota

D1, D2, D3, D4 = date(2026, 3, 2), date(2026, 3, 3), date(2026, 3, 4), date(2026, 3, 5)
X = Decimal


def seed(amount: str = "10000.00") -> list[Flow]:
    return [Flow(D1, FlowKind.SUBSCRIPTION, X(amount))]


def test_first_quota_is_one_and_subscription_issues_shares_at_it() -> None:
    s = ledger.run([], [], [], seed())[D1]
    assert s.quota == X("1.00000000")
    assert s.shares_outstanding == X("10000")
    assert s.cash == X("10000.00")


def test_buys_average_the_cost_including_fees() -> None:
    trades = [
        Trade(D2, "ALFA3", Side.BUY, X(100), X("10.00"), X("1.00")),
        Trade(D3, "ALFA3", Side.BUY, X(100), X("12.00"), X("1.00")),
    ]
    prices = [Price(D2, "ALFA3", X("10.00")), Price(D3, "ALFA3", X("12.00"))]
    s = ledger.run(trades, prices, [], seed())[D3]
    (p,) = s.positions
    assert p.quantity == 200
    assert p.average_cost == X("11.01")  # (1000 + 1 + 1200 + 1) / 200
    assert s.cash == X("7798.00")


def test_quota_is_net_asset_value_over_shares_truncated_to_8_places() -> None:
    trades = [Trade(D2, "ALFA3", Side.BUY, X(300), X("10.00"))]
    prices = [Price(D2, "ALFA3", X("10.00")), Price(D3, "ALFA3", X("10.01"))]
    s = ledger.run(trades, prices, [], seed())[D3]
    assert s.net_asset_value == X("10003.00")  # 7000 cash + 300 * 10.01
    assert s.quota == X("1.00030000")
    assert truncate_quota(X("1.000299999")) == X("1.00029999")  # truncated, not rounded


def test_sell_realizes_profit_against_the_average_cost() -> None:
    trades = [
        Trade(D2, "ALFA3", Side.BUY, X(100), X("10.00")),
        Trade(D3, "ALFA3", Side.SELL, X(40), X("12.50"), X("0.50")),
    ]
    prices = [Price(D2, "ALFA3", X("10.00")), Price(D3, "ALFA3", X("12.50"))]
    s = ledger.run(trades, prices, [], seed())[D3]
    assert s.realized_pnl == X("99.50")  # 40 * 2.50 - 0.50
    assert s.positions[0].quantity == 60
    assert s.positions[0].average_cost == X("10.00")  # selling does not change the average


def test_split_multiplies_quantity_divides_cost_and_keeps_the_value() -> None:
    trades = [Trade(D2, "BETA4", Side.BUY, X(100), X("40.00"))]
    prices = [Price(D2, "BETA4", X("40.00")), Price(D3, "BETA4", X("20.00"))]
    events = [CorporateEvent(D3, "BETA4", EventKind.SPLIT, X(2))]
    run = ledger.run(trades, prices, events, seed())
    (p,) = run[D3].positions
    assert (p.quantity, p.average_cost) == (X(200), X("20.00"))
    assert run[D3].quota == run[D2].quota  # a split alone does not move the quota


def test_dividend_credits_cash_on_the_ex_date() -> None:
    trades = [Trade(D2, "BETA4", Side.BUY, X(100), X("40.00"))]
    prices = [Price(D2, "BETA4", X("40.00")), Price(D3, "BETA4", X("39.15"))]
    events = [CorporateEvent(D3, "BETA4", EventKind.DIVIDEND, X("0.85"))]
    s = ledger.run(trades, prices, events, seed())[D3]
    assert s.cash == X("6085.00")
    assert s.net_asset_value == X("10000.00")  # the price drops by the dividend; value moves from stock to cash


def test_flows_convert_at_the_days_quota_after_it_is_computed() -> None:
    trades = [Trade(D2, "ALFA3", Side.BUY, X(500), X("10.00"))]
    prices = [Price(D2, "ALFA3", X("10.00")), Price(D3, "ALFA3", X("12.00"))]
    flows = seed() + [Flow(D3, FlowKind.SUBSCRIPTION, X("1100.00")), Flow(D4, FlowKind.REDEMPTION, X("550.00"))]
    run = ledger.run(trades, prices, [], flows)
    assert run[D3].quota == X("1.10000000")  # (5000 + 500 * 12) / 10000, before the new money
    assert run[D3].shares_outstanding == X("11000")
    assert run[D4].shares_outstanding == X("10500")


def test_a_missing_close_marks_at_the_previous_one_and_is_flagged() -> None:
    trades = [Trade(D2, "GAMA3", Side.BUY, X(10), X("60.00"))]
    prices = [Price(D2, "GAMA3", X("60.00")), Price(D3, "ALFA3", X("1.00"))]
    s = ledger.run(trades, prices, [], seed())[D3]
    assert s.positions[0].stale_price and s.positions[0].price == X("60.00")
    assert any("sem fechamento" in n for n in s.notes)


def test_selling_more_than_held_is_an_error() -> None:
    with pytest.raises(ledger.LedgerError, match="holds 0"):
        ledger.run([Trade(D2, "ALFA3", Side.SELL, X(1), X("10.00"))], [], [], seed())


def test_money_rounds_half_to_even() -> None:
    assert money(X("0.125")) == X("0.12")
    assert money(X("0.135")) == X("0.14")
    assert X("0.1") + X("0.2") == X("0.3")


def test_messages_use_brazilian_notation() -> None:
    from emaus.model import br

    assert br(X("1234567.89")) == "1.234.567,89"
    assert br(X("-0.85")) == "-0,85"
    assert br(X("2")) == "2"
