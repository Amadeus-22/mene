import { useEffect, useState } from "react";
import { api, type Day, type Portfolio, type Reconciliation } from "./api";
import { formatDate, formatDecimal, formatMoney, formatQuantity, itemLabel, sign } from "./format";

export function App() {
  const [fund, setFund] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [selected, setSelected] = useState<string>();
  const [portfolio, setPortfolio] = useState<Portfolio>();
  const [recon, setRecon] = useState<Reconciliation>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.days().then(
      (r) => {
        setFund(r.fund);
        setDays(r.days);
        setSelected(r.days.at(-1)?.date);
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

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <span className="brand">cota</span>
          <span className="fund">{fund && `fundo ${fund}`}</span>
        </div>
        <span className="muted">Carteira, cota diária e conciliação com o administrador</span>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="layout">
        <nav className="days" aria-label="Dias">
          <h2>Dias</h2>
          <ul>
            {days.map((d) => (
              <li key={d.date}>
                <button className={d.date === selected ? "day active" : "day"} onClick={() => setSelected(d.date)}>
                  <span className="day-date">{formatDate(d.date)}</span>
                  <span className="day-quota">{formatDecimal(d.quota)}</span>
                  <span className={`day-change ${sign(d.change_pct)}`}>
                    {d.change_pct === null ? "início" : `${formatDecimal(d.change_pct, 2)}%`}
                  </span>
                  <span className={d.reconciled ? "dot ok" : "dot break"} title={d.reconciled ? "conciliado" : "divergência"} />
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {portfolio && recon && day && (
          <main>
            <section className="cards">
              <Card label="Cota" value={formatDecimal(portfolio.quota)} hint={day.change_pct === null ? "cota inicial" : `${formatDecimal(day.change_pct, 2)}% no dia`} tone={sign(day.change_pct)} />
              <Card label="PL (antes dos movimentos)" value={formatMoney(portfolio.net_asset_value)} hint={`PL de fechamento ${formatMoney(portfolio.closing_net_asset_value)}`} />
              <Card label="Caixa" value={formatMoney(portfolio.cash)} hint={`Resultado realizado ${formatMoney(portfolio.realized_pnl)}`} />
              <Card label="Cotas emitidas" value={formatQuantity(portfolio.shares_outstanding)} hint="após aplicações e resgates" />
            </section>

            {portfolio.notes.length > 0 && (
              <ul className="notes">
                {portfolio.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}

            <section className="panel">
              <h2>Posições em {formatDate(portfolio.date)}</h2>
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
                          <td className="num">{formatQuantity(p.quantity)}</td>
                          <td className="num">{formatMoney(p.average_cost)}</td>
                          <td className="num">
                            {formatMoney(p.price)}
                            {p.stale_price && <span className="tag warn" title="Sem fechamento no dia: preço do dia anterior">preço antigo</span>}
                          </td>
                          <td className="num">{formatMoney(p.market_value)}</td>
                          <td className={`num ${sign(p.unrealized_pnl)}`}>{formatMoney(p.unrealized_pnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Conciliação com o administrador</h2>
                <span className={recon.matched ? "tag ok" : "tag break"}>{recon.matched ? "conciliado" : "divergência"}</span>
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
                      <tr key={l.item} className={l.status === "match" ? "" : "row-break"}>
                        <td>{itemLabel(l.item)}</td>
                        <td className="num">{l.ours === null ? "—" : formatDecimal(l.ours)}</td>
                        <td className="num">{l.theirs === null ? "—" : formatDecimal(l.theirs)}</td>
                        <td className="num">{l.difference === null ? "—" : formatDecimal(l.difference)}</td>
                        <td>
                          <span className={l.status === "match" ? "tag ok" : "tag break"}>
                            {l.status === "match" ? "ok" : l.status === "break" ? "diverge" : "faltando"}
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
          </main>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="card">
      <span className="card-label">{label}</span>
      <span className="card-value">{value}</span>
      <span className={`card-hint ${tone ?? ""}`}>{hint}</span>
    </div>
  );
}
