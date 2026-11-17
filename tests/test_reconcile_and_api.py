from datetime import date
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient

from cota import ledger
from cota.api import app
from cota.data import load
from cota.reconcile import AdminFigure, Status, reconcile

DEMO = load(Path(__file__).resolve().parent.parent / "data" / "demo")
RUN = ledger.run(DEMO.trades, DEMO.prices, DEMO.events, DEMO.flows)


def test_demo_days_without_planted_breaks_match_the_administrator() -> None:
    broken = {d for d, s in RUN.items() if not reconcile(s, DEMO.administrator, DEMO.events).matched}
    assert broken == {date(2026, 3, 10), date(2026, 3, 12)}


def test_split_missing_at_the_administrator_is_named() -> None:
    report = reconcile(RUN[date(2026, 3, 10)], DEMO.administrator, DEMO.events)
    position = next(line for line in report.lines if line.item == "POSITION:BETA4")
    assert position.status is Status.BREAK
    assert position.ours == 2 * position.theirs  # type: ignore[operator]
    assert any("não foi aplicado do lado deles" in c for c in report.causes)


def test_stale_price_on_our_side_is_named() -> None:
    report = reconcile(RUN[date(2026, 3, 12)], DEMO.administrator, DEMO.events)
    assert any("GAMA3" in c and "falta do nosso lado" in c for c in report.causes)


def test_quota_within_one_hundred_millionth_matches() -> None:
    s = RUN[date(2026, 3, 13)]
    figures = [AdminFigure(s.day, "QUOTA", s.quota + Decimal("0.00000001"))]
    quota = reconcile(s, figures, []).lines[0]
    assert quota.status is Status.MATCH


def test_api_returns_decimals_as_strings() -> None:
    client = TestClient(app)
    days = client.get("/api/days").json()["days"]
    assert days[0]["quota"] == "1.00000000"
    body = client.get("/api/portfolio/2026-03-13").json()
    assert isinstance(body["net_asset_value"], str)
    assert client.get("/api/reconciliation/2026-03-10").json()["matched"] is False
    assert client.get("/api/portfolio/2027-01-01").status_code == 404
