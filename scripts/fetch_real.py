"""Downloads the public data for the mirror quota and writes a small extract.

Sources (cached in ~/.cache/emaus/raw, ~150 MB on the first run):
- CVM CDA for the month before the period: the fund's stocks and PL.
- CVM informe diário for that month end and the period: the official quota.
- B3 COTAHIST for the year: daily closes of the fund's stocks.
- Banco Central SGS 12: daily CDI.

Writes data/real/<slug>/ (gitignored): holdings.csv, official.csv, closes.csv,
cdi.csv and fund.json.

Run: python scripts/fetch_real.py   (defaults: CAIXA Brasil Indexa Ibovespa, Oct 2026)
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from emaus import sources  # noqa: E402

CACHE = Path.home() / ".cache" / "emaus" / "raw"
CVM = "https://dados.cvm.gov.br/dados/FI/DOC"
UA = {"User-Agent": "emaus/0.1 (open-data research)"}


def download(url: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / url.rsplit("/", 1)[1]
    if not target.exists():
        print(f"downloading {url}", file=sys.stderr)
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
            target.write_bytes(r.read())
    return target


def member(archive: Path, name: str) -> list[str]:
    with zipfile.ZipFile(archive) as z:
        return z.read(name).decode("latin-1").splitlines()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cnpj", default="13.058.816/0001-18")
    ap.add_argument("--slug", default="caixa-indexa-ibovespa")
    ap.add_argument("--name", default="CAIXA Brasil Indexa Ibovespa FIF Ações")
    ap.add_argument("--cda", default="202609", help="month of the disclosed portfolio (YYYYMM)")
    ap.add_argument("--period", default="202610", help="month to mirror (YYYYMM)")
    a = ap.parse_args()

    cda = download(f"{CVM}/CDA/DADOS/cda_fi_{a.cda}.zip")
    holdings = sources.cda_stocks(member(cda, f"cda_fi_BLC_4_{a.cda}.csv"), a.cnpj)
    start, nav = sources.cda_net_asset_value(member(cda, f"cda_fi_PL_{a.cda}.csv"), a.cnpj)

    official = []
    for month in (a.cda, a.period):
        daily = download(f"{CVM}/INF_DIARIO/DADOS/inf_diario_fi_{month}.zip")
        official += sources.daily_reports(member(daily, f"inf_diario_fi_{month}.csv"), a.cnpj)
    official = [d for d in official if d.day >= start]

    year = a.period[:4]
    hist = download(f"https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A{year}.ZIP")
    with zipfile.ZipFile(hist) as z:
        lines = z.read(z.namelist()[0]).decode("latin-1").splitlines()
    end = official[-1].day
    closes = {
        k: v for k, v in sources.cotahist_closes(lines, {h.ticker for h in holdings}).items() if start <= k[0] <= end
    }

    sgs = (
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json"
        f"&dataInicial={start:%d/%m/%Y}&dataFinal={end:%d/%m/%Y}"
    )
    with urllib.request.urlopen(urllib.request.Request(sgs, headers=UA), timeout=60) as r:
        cdi = sources.sgs_rates(json.load(r))

    out = ROOT / "data" / "real" / a.slug
    out.mkdir(parents=True, exist_ok=True)
    write(
        out / "holdings.csv",
        ["ticker", "quantity", "market_value"],
        [(h.ticker, h.quantity, h.market_value) for h in holdings],
    )
    write(
        out / "official.csv",
        ["date", "quota", "net_asset_value", "subscriptions", "redemptions", "holders"],
        [(d.day, d.quota, d.net_asset_value, d.subscriptions, d.redemptions, d.holders) for d in official],
    )
    write(out / "closes.csv", ["date", "ticker", "close"], [(d, t, c) for (d, t), c in sorted(closes.items())])
    write(out / "cdi.csv", ["date", "rate_pct"], sorted(cdi.items()))
    (out / "fund.json").write_text(
        json.dumps(
            {
                "name": a.name,
                "cnpj": a.cnpj,
                "portfolio_date": start.isoformat(),
                "net_asset_value": str(nav),
                "sources": {
                    "portfolio": f"CVM CDA {a.cda} (cda_fi_BLC_4, cda_fi_PL)",
                    "official_quota": f"CVM informe diário {a.cda}, {a.period}",
                    "prices": f"B3 COTAHIST {year}",
                    "cdi": "Banco Central SGS 12",
                },
                "fetched": date.today().isoformat(),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{len(holdings)} stocks, {len(official)} official days, {len(closes)} closes -> {out}")


def write(path: Path, header: list[str], rows: list[tuple[object, ...]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


if __name__ == "__main__":
    main()
