import { useEffect, useState } from "react";
import { realApi, type RealFund as Data } from "./api";
import {
  formatDate,
  formatDecimal,
  formatMoney,
  formatQuantity,
  sign,
} from "./format";
import { MirrorChart } from "./MirrorChart";

type Tab = "espelho" | "diferenca" | "carteira" | "conferencia";

const TABS: { id: Tab; label: string }[] = [
  { id: "espelho", label: "Cota espelho" },
  { id: "diferenca", label: "Diferença diária" },
  { id: "carteira", label: "Carteira" },
  { id: "conferencia", label: "Conferência" },
];

export function RealFund({ slug }: { slug: string }) {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>("espelho");

  useEffect(() => {
    realApi.fund(slug).then(setData, (e: Error) => setError(e.message));
  }, [slug]);

  if (error)
    return (
      <div className="error">
        {error}. Rode `make real` para baixar os dados.
      </div>
    );
  if (!data) return <p className="muted">Carregando…</p>;

  const last = data.days.at(-1);
  const flagged = data.days.filter((d) => d.flagged);
  const exact = data.check.mismatches.length === 0;

  return (
    <>
      <header className="fund-head">
        <div className="fund-title">
          <span className="eyebrow">Classe · CNPJ {data.info.cnpj}</span>
          <h1>{data.info.name}</h1>
          <div className="chips">
            <span className="chip chip-ok">Dados reais</span>
            <span className="chip">Ações indexado Ibovespa</span>
            <span className="chip">Carteira de {formatDate(data.start)}</span>
            {flagged.length > 0 && (
              <span className="chip chip-break">
                {flagged.length} salto(s) a explicar
              </span>
            )}
          </div>
        </div>
      </header>

      {last && (
        <section className="kpis">
          <Kpi
            label="Cota oficial (CVM)"
            value={formatDecimal(last.official_quota, 6)}
            sub={formatDate(last.date)}
          />
          <Kpi
            label="Nossa cota espelho"
            value={formatDecimal(last.our_quota, 6)}
            sub={formatDate(last.date)}
          />
          <Kpi
            label="Diferença"
            value={`${formatDecimal(last.gap_bps)} bps`}
            tone={sign(last.gap_bps)}
            sub="1 bps = 0,01%"
          />
          <Kpi
            label="Conferência da carteira"
            value={
              exact
                ? "ao centavo"
                : `${data.check.mismatches.length} diferença(s)`
            }
            tone={exact ? "up" : "down"}
            sub={`${data.check.stocks} ações em ${formatDate(data.start)}`}
          />
          <Kpi
            label="Patrimônio líquido"
            value={formatMoney(last.net_asset_value)}
            sub="oficial"
          />
          <Kpi label="Cotistas" value={formatQuantity(String(last.holders))} />
        </section>
      )}

      <p className="section-label">Como a cota espelho é calculada</p>
      <section className="structure">
        <div className="box">
          <Field
            label="Carteira"
            value={`CVM CDA de ${formatDate(data.start)}, mantida fixa`}
          />
          <Field label="Preços" value="Fechamento diário da B3 (COTAHIST)" />
          <Field
            label="Caixa e provisões"
            value={`${formatMoney(data.other_assets)} corrigidos pelo CDI`}
          />
        </div>
        <div className="box">
          <Field
            label="Cotas"
            value={`${formatDecimal(data.shares)} (PL ÷ cota oficial na data da carteira)`}
          />
          <Field
            label="Comparação"
            value="Cota oficial do informe diário da CVM"
          />
          <Field
            label="Não vemos"
            value="Trocas de carteira, dividendos a receber e taxas"
          />
        </div>
      </section>

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
            {t.id === "diferenca" && flagged.length > 0 && (
              <span className="tab-dot" aria-label="saltos" />
            )}
          </button>
        ))}
      </div>

      {tab === "espelho" && (
        <section className="tab-body">
          <h2>Cota oficial × cota espelho</h2>
          <p className="muted">
            Rentabilidade acumulada desde {formatDate(data.start)}. As duas
            linhas quase se sobrepõem: a diferença está na aba Diferença diária.
          </p>
          <MirrorChart days={data.days} />
        </section>
      )}

      {tab === "diferenca" && (
        <section className="tab-body">
          <h2>Diferença diária</h2>
          <p className="muted">
            Diferença entre a nossa cota e a oficial, em pontos-base. Saltos
            acima de 3 bps num dia são destacados com o primeiro lugar onde
            procurar.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="num">Cota oficial</th>
                  <th className="num">Cota espelho</th>
                  <th className="num">Diferença (bps)</th>
                  <th className="num">Variação no dia (bps)</th>
                  <th className="num">Aplicações</th>
                  <th className="num">Resgates</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.date} className={d.flagged ? "row-break" : ""}>
                    <td>{formatDate(d.date)}</td>
                    <td className="num">
                      {formatDecimal(d.official_quota, 6)}
                    </td>
                    <td className="num">{formatDecimal(d.our_quota, 6)}</td>
                    <td className="num">{formatDecimal(d.gap_bps)}</td>
                    <td className="num">
                      {d.gap_change_bps === null
                        ? "—"
                        : formatDecimal(d.gap_change_bps)}
                    </td>
                    <td className="num">{formatMoney(d.subscriptions)}</td>
                    <td className="num">{formatMoney(d.redemptions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {flagged.map((d) => (
            <div key={d.date} className="causes">
              <h3>{formatDate(d.date)}: causa provável</h3>
              <p>{d.explanation}</p>
              {d.movers.length > 0 && (
                <p className="small">
                  Maiores contribuições no dia:{" "}
                  {d.movers
                    .map(
                      (m) =>
                        `${m.ticker} (${formatDecimal(m.return_pct)}%, ${formatDecimal(m.contribution_bps)} bps)`,
                    )
                    .join(", ")}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "carteira" && (
        <section className="tab-body">
          <h2>Carteira divulgada em {formatDate(data.start)}</h2>
          <p className="muted">
            {data.holdings.length} ações, da maior para a menor. Peso sobre o PL
            de {formatMoney(data.start_nav)}.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th className="num">Quantidade</th>
                  <th className="num">Fechamento B3</th>
                  <th className="num">Valor de mercado</th>
                  <th className="num">Peso</th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.map((h) => (
                  <tr key={h.ticker}>
                    <td className="ticker">{h.ticker}</td>
                    <td className="num">{formatQuantity(h.quantity)}</td>
                    <td className="num">
                      {h.close === null ? "—" : formatMoney(h.close)}
                    </td>
                    <td className="num">{formatMoney(h.market_value)}</td>
                    <td className="num">{formatDecimal(h.weight_pct, 2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "conferencia" && (
        <section className="tab-body">
          <h2>Conferência antes de confiar no cálculo</h2>
          <p className="muted">
            Na data da carteira, quantidade × fechamento da B3 precisa bater com
            o valor de mercado que o administrador informou à CVM, ação por
            ação. Se não bater, nada depois disso é confiável.
          </p>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <td>Ações conferidas</td>
                  <td className="num">{data.check.stocks}</td>
                </tr>
                <tr>
                  <td>Nosso cálculo (quantidade × fechamento)</td>
                  <td className="num">{formatMoney(data.check.ours)}</td>
                </tr>
                <tr>
                  <td>Valor informado pelo administrador</td>
                  <td className="num">
                    {formatMoney(data.check.administrator)}
                  </td>
                </tr>
                <tr className={exact ? "" : "row-break"}>
                  <td>Ações com diferença</td>
                  <td className="num">
                    {exact
                      ? "nenhuma"
                      : data.check.mismatches.map((m) => m.ticker).join(", ")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Fontes: {Object.values(data.info.sources).join(" · ")}. Extraído em{" "}
            {formatDate(data.info.fetched)}.
          </p>
        </section>
      )}
    </>
  );
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
