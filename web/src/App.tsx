import { useEffect, useState } from "react";
import {
  api,
  realApi,
  type Day,
  type Fund,
  type Portfolio,
  type RealSummary,
  type Reconciliation,
} from "./api";
import {
  formatDate,
  formatDecimal,
  formatMoney,
  formatQuantity,
  itemLabel,
  sign,
} from "./format";
import { QuotaChart } from "./QuotaChart";
import { Logo, LogoMark } from "./Logo";
import { RealFund } from "./RealFund";

type Tab = "indicadores" | "carteira" | "conciliacao" | "periodicos";

const TABS: { id: Tab; label: string }[] = [
  { id: "indicadores", label: "Indicadores" },
  { id: "carteira", label: "Carteira" },
  { id: "conciliacao", label: "Conciliação" },
  { id: "periodicos", label: "Dados periódicos" },
];

export function App() {
  const [fund, setFund] = useState<Fund>();
  const [days, setDays] = useState<Day[]>([]);
  const [selected, setSelected] = useState<string>();
  const [tab, setTab] = useState<Tab>("indicadores");
  const [portfolio, setPortfolio] = useState<Portfolio>();
  const [recon, setRecon] = useState<Reconciliation>();
  const [error, setError] = useState<string>();
  const route = useRoute();

  useEffect(() => {
    const wanted = new URLSearchParams(
      window.location.hash.split("?")[1] ?? "",
    ).get("aba");
    if (wanted && TABS.some((t) => t.id === wanted)) setTab(wanted as Tab);
    const day = new URLSearchParams(
      window.location.hash.split("?")[1] ?? "",
    ).get("dia");
    if (day) setSelected(day);
  }, [route]);

  useEffect(() => {
    Promise.all([api.fund(), api.days()]).then(
      ([f, d]) => {
        setFund(f);
        setDays(d.days);
        const wanted = new URLSearchParams(
          window.location.hash.split("?")[1] ?? "",
        ).get("dia");
        setSelected(
          d.days.some((x) => x.date === wanted) ? wanted! : d.days.at(-1)?.date,
        );
      },
      (e: Error) => setError(e.message),
    );
  }, []);

  useEffect(() => {
    if (!selected) return;
    Promise.all([api.portfolio(selected), api.reconciliation(selected)]).then(
      ([p, r]) => {
        setPortfolio(p);
        setRecon(r);
      },
      (e: Error) => setError(e.message),
    );
  }, [selected]);

  const day = days.find((d) => d.date === selected);
  const breaks = days.filter((d) => !d.reconciled).length;

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <a className="brand" href="#/inicio">
            <Logo size={30} />
          </a>
          <nav className="appnav" aria-label="Principal">
            <a
              href="#/inicio"
              aria-current={route === "home" ? "page" : undefined}
            >
              Início
            </a>
            <a
              href="#/fundos"
              aria-current={route !== "home" ? "page" : undefined}
            >
              Fundos
            </a>
          </nav>
        </div>
      </header>
      <div className="page">
        <Crumbs route={route} />

        {error && <div className="error">{error}</div>}

        {route === "home" && <Home fund={fund} days={days} />}
        {route === "funds" && <FundList fund={fund} days={days} />}
        {route === "real" && <RealFund slug={realSlug()} />}
        {route === "fund" && (
          <>
            {fund && (
              <header className="fund-head">
                <div className="fund-title">
                  <span className="eyebrow">{fund.kind}</span>
                  <h1>{fund.name}</h1>
                  <div className="chips">
                    {fund.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                    <span
                      className={breaks ? "chip chip-break" : "chip chip-ok"}
                    >
                      {breaks
                        ? `${breaks} dia(s) com divergência`
                        : "Conciliado"}
                    </span>
                  </div>
                </div>
                <label className="ref-date">
                  Data de referência
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {days.map((d) => (
                      <option key={d.date} value={d.date}>
                        {formatDate(d.date)}
                        {d.reconciled ? "" : "  •  divergência"}
                      </option>
                    ))}
                  </select>
                </label>
              </header>
            )}

            {day && portfolio && (
              <section className="kpis">
                <Kpi
                  label="Patrimônio líquido"
                  value={formatMoney(day.closing_net_asset_value)}
                  sub={formatDate(day.date)}
                />
                <Kpi
                  label="Valor da cota"
                  value={formatDecimal(day.quota)}
                  sub={formatDate(day.date)}
                />
                <Kpi
                  label="Variação no dia"
                  value={
                    day.change_pct === null
                      ? "—"
                      : `${arrow(day.change_pct)} ${formatDecimal(day.change_pct, 2)}%`
                  }
                  tone={sign(day.change_pct)}
                />
                <Kpi
                  label="Rentabilidade acumulada"
                  value={`${arrow(day.return_pct)} ${formatDecimal(day.return_pct, 2)}%`}
                  tone={sign(day.return_pct)}
                  sub="desde o início"
                />
                <Kpi label="Caixa" value={formatMoney(portfolio.cash)} />
                <Kpi
                  label="Cotas emitidas"
                  value={formatQuantity(portfolio.shares_outstanding)}
                />
              </section>
            )}

            {fund && (
              <>
                <p className="section-label">Estruturação do fundo</p>
                <section className="structure">
                  <div className="box">
                    <Field label="Administrador" value={fund.administrator} />
                    <Field label="Gestor" value={fund.manager} />
                    <Field label="Custodiante" value={fund.custodian} />
                  </div>
                  <div className="box">
                    <Field label="Cálculo da cota" value={fund.quota_rule} />
                    <Field
                      label="Conversão da aplicação"
                      value={fund.subscription_settlement}
                    />
                    <Field
                      label="Conversão do resgate"
                      value={fund.redemption_settlement}
                    />
                  </div>
                </section>
              </>
            )}

            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? "tab active" : "tab"}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.id === "conciliacao" && recon && !recon.matched && (
                    <span className="tab-dot" aria-label="divergência" />
                  )}
                </button>
              ))}
            </div>

            {tab === "indicadores" && day && (
              <section className="tab-body">
                <h2>Rentabilidade</h2>
                <p className="muted">
                  Rentabilidade acumulada da cota. Clique em um dia para usá-lo
                  como data de referência.
                </p>
                <p className="headline">
                  Período total{" "}
                  <span className={sign(days.at(-1)?.return_pct ?? null)}>
                    {arrow(days.at(-1)?.return_pct ?? "0")}{" "}
                    {formatDecimal(days.at(-1)?.return_pct ?? "0", 2)}%
                  </span>
                </p>
                <QuotaChart
                  days={days}
                  selected={selected}
                  onSelect={setSelected}
                />
              </section>
            )}

            {tab === "carteira" && portfolio && (
              <section className="tab-body">
                <h2>Carteira em {formatDate(portfolio.date)}</h2>
                {portfolio.notes.length > 0 && (
                  <ul className="notes">
                    {portfolio.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                {portfolio.positions.length === 0 ? (
                  <p className="muted">Sem posições: o fundo está em caixa.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ativo</th>
                          <th className="num">Quantidade</th>
                          <th className="num">Preço médio</th>
                          <th className="num">Fechamento</th>
                          <th className="num">Valor de mercado</th>
                          <th className="num">Resultado não realizado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.positions.map((p) => (
                          <tr key={p.ticker}>
                            <td className="ticker">{p.ticker}</td>
                            <td className="num">
                              {formatQuantity(p.quantity)}
                            </td>
                            <td className="num">
                              {formatMoney(p.average_cost)}
                            </td>
                            <td className="num">
                              {p.stale_price && (
                                <span className="chip chip-warn">
                                  preço antigo
                                </span>
                              )}{" "}
                              {formatMoney(p.price)}
                            </td>
                            <td className="num">
                              {formatMoney(p.market_value)}
                            </td>
                            <td className={`num ${sign(p.unrealized_pnl)}`}>
                              {formatMoney(p.unrealized_pnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="muted small">
                  Resultado realizado desde o início:{" "}
                  {formatMoney(portfolio.realized_pnl)}
                </p>
              </section>
            )}

            {tab === "conciliacao" && recon && (
              <section className="tab-body">
                <div className="row">
                  <h2>
                    Conciliação com o administrador em {formatDate(recon.date)}
                  </h2>
                  <span
                    className={
                      recon.matched ? "chip chip-ok" : "chip chip-break"
                    }
                  >
                    {recon.matched ? "conciliado" : "divergência"}
                  </span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="num">Nosso cálculo</th>
                        <th className="num">Administrador</th>
                        <th className="num">Diferença</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.lines.map((l) => (
                        <tr
                          key={l.item}
                          className={l.status === "match" ? "" : "row-break"}
                        >
                          <td>{itemLabel(l.item)}</td>
                          <td className="num">
                            {l.ours === null ? "—" : formatDecimal(l.ours)}
                          </td>
                          <td className="num">
                            {l.theirs === null ? "—" : formatDecimal(l.theirs)}
                          </td>
                          <td className="num">
                            {l.difference === null
                              ? "—"
                              : formatDecimal(l.difference)}
                          </td>
                          <td>
                            <span
                              className={
                                l.status === "match"
                                  ? "chip chip-ok"
                                  : "chip chip-break"
                              }
                            >
                              {l.status === "match"
                                ? "✓ ok"
                                : l.status === "break"
                                  ? "✕ diverge"
                                  : "faltando"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {recon.causes.length > 0 && (
                  <div className="causes">
                    <h3>Causa provável</h3>
                    <ul>
                      {recon.causes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {tab === "periodicos" && (
              <section className="tab-body">
                <h2>Dados periódicos</h2>
                <p className="muted">
                  PL e cota diários, mais recentes primeiro. Clique em uma linha
                  para usá-la como data de referência.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Data competência</th>
                        <th className="num">Patrimônio líquido</th>
                        <th className="num">Valor da cota</th>
                        <th className="num">Aplicações</th>
                        <th className="num">Resgates</th>
                        <th>Conciliação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...days].reverse().map((d) => (
                        <tr
                          key={d.date}
                          className={`clickable ${d.date === selected ? "row-selected" : ""}`}
                          onClick={() => setSelected(d.date)}
                        >
                          <td>{formatDate(d.date)}</td>
                          <td className="num">
                            {formatMoney(d.closing_net_asset_value)}
                          </td>
                          <td className="num">{formatDecimal(d.quota)}</td>
                          <td className="num">
                            {formatMoney(d.subscriptions)}
                          </td>
                          <td className="num">{formatMoney(d.redemptions)}</td>
                          <td>
                            <span
                              className={
                                d.reconciled
                                  ? "chip chip-ok"
                                  : "chip chip-break"
                              }
                            >
                              {d.reconciled ? "✓ ok" : "✕ divergência"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        <footer className="disclaimer">
          {route === "real"
            ? "Dados públicos da CVM, da B3 e do Banco Central. A cota espelho é uma estimativa independente, não a cota oficial do fundo."
            : "O fundo demo é fictício: tickers, preços e prestadores não são reais. Os fundos marcados como dados reais usam dados públicos da CVM, da B3 e do Banco Central."}
        </footer>
      </div>
    </>
  );
}

function arrow(v: string): string {
  const s = sign(v);
  return s === "up" ? "↑" : s === "down" ? "↓" : "";
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value ${tone ?? ""}`}>{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

type Route = "home" | "funds" | "fund" | "real";

function routeFromHash(): Route {
  const path = window.location.hash.replace(/^#/, "").split("?")[0];
  if (path === "/" || path === "") return "fund";
  if (path === "/inicio") return "home";
  if (path === "/fundos") return "funds";
  if (path.startsWith("/fundos/real/")) return "real";
  return "fund";
}

function realSlug(): string {
  return decodeURIComponent(
    window.location.hash.replace(/^#\/fundos\/real\//, "").split("?")[0],
  );
}

function useRealFunds(): RealSummary[] {
  const [funds, setFunds] = useState<RealSummary[]>([]);
  useEffect(() => {
    realApi.list().then(
      (r) => setFunds(r.funds),
      () => setFunds([]),
    );
  }, []);
  return funds;
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(routeFromHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function Crumbs({ route }: { route: Route }) {
  const items: { label: string; href: string; here: boolean }[] = [
    { label: "Início", href: "#/inicio", here: route === "home" },
    { label: "Fundos", href: "#/fundos", here: route === "funds" },
  ];
  if (route === "fund")
    items.push({
      label: "Detalhes do fundo",
      href: "#/fundos/demo",
      here: true,
    });
  if (route === "real")
    items.push({
      label: "Detalhes do fundo",
      href: window.location.hash,
      here: true,
    });
  return (
    <nav className="crumbs" aria-label="Navegação">
      {items.map((it, i) => (
        <span key={it.href} className="crumb">
          {i > 0 && <span aria-hidden="true">›</span>}
          {it.here ? (
            <strong aria-current="page">{it.label}</strong>
          ) : (
            <a href={it.href}>{it.label}</a>
          )}
        </span>
      ))}
    </nav>
  );
}

function Home({ fund, days }: { fund?: Fund; days: Day[] }) {
  const real = useRealFunds();
  const last = days.at(-1);
  const breaks = days.filter((d) => !d.reconciled);
  return (
    <section className="home">
      <div className="fund-title">
        <div className="hero">
          <LogoMark size={64} />
          <div>
            <h1 className="hero-title">Emaús</h1>
            <p className="hero-sub">Back office de fundos</p>
          </div>
        </div>
        <p className="muted">
          Carteira, cota diária e conciliação com o administrador, com dados
          públicos da CVM, da B3 e do Banco Central. Escolha por onde começar.
        </p>
      </div>
      <div className="home-grid">
        <a className="home-card" href="#/fundos">
          <span className="kpi-label">Fundos</span>
          <span className="kpi-value">{1 + real.length} fundo(s)</span>
          <span className="kpi-sub">
            {[fund?.name, ...real.map((r) => r.name)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </a>
        {real.map((r) => (
          <a
            key={r.slug}
            className="home-card"
            href={`#/fundos/real/${r.slug}`}
          >
            <span className="kpi-label">Cota espelho · dados reais</span>
            <span className="kpi-value">
              {r.gap_bps === null ? "—" : `${formatDecimal(r.gap_bps)} bps`}
            </span>
            <span className="kpi-sub">
              {r.name}, em {r.last_date ? formatDate(r.last_date) : "—"}
            </span>
          </a>
        ))}
        {last && (
          <a className="home-card" href="#/fundos/demo?aba=indicadores">
            <span className="kpi-label">Última cota · fundo demo</span>
            <span className="kpi-value">{formatDecimal(last.quota)}</span>
            <span className="kpi-sub">{formatDate(last.date)}</span>
          </a>
        )}
        <a
          className={breaks.length ? "home-card warn" : "home-card"}
          href={
            breaks.length
              ? `#/fundos/demo?aba=conciliacao&dia=${breaks[0].date}`
              : "#/fundos/demo?aba=conciliacao"
          }
        >
          <span className="kpi-label">Divergências com o administrador</span>
          <span className={`kpi-value ${breaks.length ? "down" : "up"}`}>
            {breaks.length ? `${breaks.length} dia(s)` : "nenhuma"}
          </span>
          <span className="kpi-sub">
            {breaks.length
              ? `abrir ${formatDate(breaks[0].date)}`
              : "tudo conciliado"}
          </span>
        </a>
      </div>
    </section>
  );
}

function FundList({ fund, days }: { fund?: Fund; days: Day[] }) {
  const real = useRealFunds();
  const last = days.at(-1);
  if (!fund || !last) return <p className="muted">Carregando…</p>;
  const breaks = days.filter((d) => !d.reconciled).length;
  return (
    <section className="tab-body">
      <h2>Fundos</h2>
      <p className="muted">Clique em um fundo para ver os detalhes.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fundo</th>
              <th>Categoria</th>
              <th className="num">Patrimônio líquido</th>
              <th className="num">Valor da cota</th>
              <th className="num">Rentabilidade acumulada</th>
              <th>Conciliação</th>
            </tr>
          </thead>
          <tbody>
            <tr
              className="clickable"
              onClick={() => (window.location.hash = "#/fundos/demo")}
            >
              <td className="ticker">
                <a href="#/fundos/demo">{fund.name}</a>
              </td>
              <td>{fund.tags[0]}</td>
              <td className="num">
                {formatMoney(last.closing_net_asset_value)}
              </td>
              <td className="num">{formatDecimal(last.quota)}</td>
              <td className={`num ${sign(last.return_pct)}`}>
                {formatDecimal(last.return_pct, 2)}%
              </td>
              <td>
                <span className={breaks ? "chip chip-break" : "chip chip-ok"}>
                  {breaks ? `${breaks} dia(s) com divergência` : "conciliado"}
                </span>
              </td>
            </tr>
            {real.map((r) => (
              <tr
                key={r.slug}
                className="clickable"
                onClick={() =>
                  (window.location.hash = `#/fundos/real/${r.slug}`)
                }
              >
                <td className="ticker">
                  <a href={`#/fundos/real/${r.slug}`}>{r.name}</a>{" "}
                  <span className="chip chip-ok">dados reais</span>
                </td>
                <td>Ações indexado</td>
                <td className="num">
                  {r.net_asset_value === null
                    ? "—"
                    : formatMoney(r.net_asset_value)}
                </td>
                <td className="num">
                  {r.official_quota === null
                    ? "—"
                    : formatDecimal(r.official_quota, 6)}
                </td>
                <td className="num">
                  {r.gap_bps === null
                    ? "—"
                    : `espelho ${formatDecimal(r.gap_bps)} bps`}
                </td>
                <td>
                  <span
                    className={
                      r.flagged_days ? "chip chip-break" : "chip chip-ok"
                    }
                  >
                    {r.flagged_days
                      ? `${r.flagged_days} salto(s) a explicar`
                      : "sem saltos"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
