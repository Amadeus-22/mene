import { useEffect, useState } from "react";

const SOURCES = [
  {
    id: "cvm-cda",
    name: "Carteira do fundo (CDA)",
    org: "CVM",
    file: "cda_fi_BLC_4_AAAAMM.csv, cda_fi_PL_AAAAMM.csv",
    frequency: "Mensal, posição do último dia útil",
    use: "Quantidade e valor de mercado de cada ação do fundo e o patrimônio líquido na data da carteira. É o ponto de partida da cota espelho e da conferência ao centavo.",
    url: "https://dados.cvm.gov.br/dataset/fi-doc-cda",
  },
  {
    id: "cvm-informe",
    name: "Informe diário",
    org: "CVM",
    file: "inf_diario_fi_AAAAMM.csv",
    frequency: "Diário",
    use: "Cota oficial, PL, aplicações, resgates e número de cotistas de cada dia. É a referência contra a qual a cota espelho é comparada.",
    url: "https://dados.cvm.gov.br/dataset/fi-doc-inf_diario",
  },
  {
    id: "b3-cotahist",
    name: "Cotações históricas (COTAHIST)",
    org: "B3",
    file: "COTAHIST_AAAAA.ZIP (layout de largura fixa)",
    frequency: "Diário",
    use: "Preço de fechamento de cada ação no mercado à vista, usado para marcar a carteira a mercado todos os dias.",
    url: "https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/cotacoes-historicas/",
  },
  {
    id: "bcb-cdi",
    name: "Taxa CDI (série 12)",
    org: "Banco Central",
    file: "API SGS, série 12 (JSON)",
    frequency: "Diário",
    use: "Correção diária da parte da carteira que não é ação: caixa, valores a receber e a pagar.",
    url: "https://dadosabertos.bcb.gov.br/dataset/12-taxa-de-juros---cdi",
  },
];

export function Datasets() {
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const pick = () => {
      const id = new URLSearchParams(
        window.location.hash.split("?")[1] ?? "",
      ).get("fonte");
      setFocus(id);
      if (id)
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, []);
  return (
    <section className="info">
      <div className="fund-title">
        <span className="eyebrow">Datasets</span>
        <h1>Fontes de dados</h1>
        <p className="muted">
          Tudo o que o Mene usa é dado público e oficial. Os arquivos são
          baixados com <code>make real</code>, guardados em cache e lidos direto
          para <code>Decimal</code>, sem passar por ponto flutuante.
        </p>
      </div>
      <div className="source-grid">
        {SOURCES.map((s) => (
          <article
            key={s.id}
            id={s.id}
            className={focus === s.id ? "source focus" : "source"}
          >
            <header>
              <span className="chip">{s.org}</span>
              <h2>{s.name}</h2>
            </header>
            <dl>
              <dt>Arquivo</dt>
              <dd>
                <code>{s.file}</code>
              </dd>
              <dt>Frequência</dt>
              <dd>{s.frequency}</dd>
              <dt>Como usamos</dt>
              <dd>{s.use}</dd>
            </dl>
            <a
              className="source-link"
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              Fonte oficial ↗
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Carteira e preços",
    text: "Lemos a carteira divulgada à CVM (78 ações e o PL em 30/09) e o fechamento de cada ação na B3.",
  },
  {
    title: "Conferência ao centavo",
    text: "Quantidade × fechamento precisa bater com o valor que o administrador informou, ação por ação. Se não bater, paramos: o resto não seria confiável.",
    gate: true,
  },
  {
    title: "Cotas e caixa",
    text: "Cotas = PL ÷ cota oficial na data da carteira. Caixa e provisões = PL − ações, corrigidos pelo CDI a cada dia.",
  },
  {
    title: "Cota espelho diária",
    text: "Ações a preço de fechamento + caixa, divididos pelas cotas, com 8 casas truncadas. Aplicações e resgates não mudam a cota de um fundo de índice.",
  },
  {
    title: "Diferença em pontos-base",
    text: "Comparamos com a cota oficial do informe diário. 1 ponto-base = 0,01%.",
  },
  {
    title: "Explicar os saltos",
    text: "Se a diferença muda mais de 3 bps num dia, o dia é destacado com a leitura provável (data ex de dividendos, troca de carteira) e as ações que mais pesaram.",
    gate: true,
  },
];

export function Methodology() {
  return (
    <section className="info">
      <div className="fund-title">
        <span className="eyebrow">Metodologia</span>
        <h1>Como a cota espelho é calculada</h1>
        <p className="muted">
          Não vemos as operações do fundo, então reconstruímos a cota a partir
          do que é público e explicamos a diferença em vez de escondê-la.
        </p>
      </div>

      <ol className="flow">
        {STEPS.map((s, i) => (
          <li key={s.title} className={s.gate ? "flow-step gate" : "flow-step"}>
            <span className="flow-n">{i + 1}</span>
            <div>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="structure">
        <div className="box single">
          <div className="field">
            <span className="field-label">O que a cota espelho não vê</span>
            <span>
              Trocas de carteira depois da data divulgada (rebalanceamento do
              índice), dividendos a receber e as taxas do fundo. É daí que vem a
              diferença que sobra.
            </span>
          </div>
        </div>
        <div className="box single">
          <div className="field">
            <span className="field-label">Regras de dinheiro</span>
            <span>
              Valores em <code>Decimal</code> do arquivo até a tela; a API envia
              números como texto; cota truncada em 8 casas; centavos
              arredondados pela regra do banqueiro.
            </span>
          </div>
        </div>
      </div>

      <p className="muted small">
        Para ver os números:{" "}
        <a href="#/fundos/real/caixa-indexa-ibovespa">
          cota espelho do fundo real
        </a>{" "}
        · <a href="#/datasets">fontes de dados</a>.
      </p>
    </section>
  );
}
