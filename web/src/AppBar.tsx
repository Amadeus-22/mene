import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";

const REPO = "https://github.com/Amadeus-22/emaus";

type Item = { label: string; href: string; external?: boolean; hint?: string };
type Menu = { label: string; items: Item[] };

const MENUS: Menu[] = [
  {
    label: "Dados de mercado",
    items: [
      {
        label: "Cota espelho",
        href: "#/fundos/real/caixa-indexa-ibovespa",
        hint: "fundo real, dados da CVM e da B3",
      },
      {
        label: "Diferença diária",
        href: "#/fundos/real/caixa-indexa-ibovespa?aba=diferenca",
        hint: "cota oficial × espelho em bps",
      },
      {
        label: "Conciliação",
        href: "#/fundos/demo?aba=conciliacao&dia=2026-03-10",
        hint: "fundo demo com divergências",
      },
      {
        label: "Dados periódicos",
        href: "#/fundos/demo?aba=periodicos",
        hint: "PL e cota diários",
      },
    ],
  },
  {
    label: "Datasets",
    items: [
      {
        label: "CVM · Carteira (CDA)",
        href: "https://dados.cvm.gov.br/dataset/fi-doc-cda",
        external: true,
      },
      {
        label: "CVM · Informe diário",
        href: "https://dados.cvm.gov.br/dataset/fi-doc-inf_diario",
        external: true,
      },
      {
        label: "B3 · Cotações históricas",
        href: "https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/cotacoes-historicas/",
        external: true,
      },
      {
        label: "Banco Central · CDI (SGS 12)",
        href: "https://dadosabertos.bcb.gov.br/dataset/12-taxa-de-juros---cdi",
        external: true,
      },
    ],
  },
];

/** Full-width header: logo on the left, menus on the right, a drawer on phones. */
export function AppBar({ route }: { route: string }) {
  const [open, setOpen] = useState<string>();
  const [drawer, setDrawer] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(undefined);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(undefined);
        setDrawer(false);
      }
    };
    const nav = () => {
      setOpen(undefined);
      setDrawer(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("hashchange", nav);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("hashchange", nav);
    };
  }, []);

  return (
    <header className="appbar" ref={ref}>
      <div className="appbar-inner">
        <a className="brand" href="#/inicio" aria-label="Emaús, início">
          <Logo size={34} />
        </a>

        <button
          className="menu-toggle"
          aria-expanded={drawer}
          aria-controls="mainnav"
          onClick={() => setDrawer((d) => !d)}
        >
          <span className="sr-only">Menu</span>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            {drawer ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>

        <nav
          id="mainnav"
          className={drawer ? "mainnav open" : "mainnav"}
          aria-label="Principal"
        >
          <a
            className="navlink"
            href="#/fundos"
            aria-current={
              route === "funds" || route === "fund" || route === "real"
                ? "page"
                : undefined
            }
          >
            Fundos
          </a>
          {MENUS.map((m) => (
            <div key={m.label} className="navmenu">
              <button
                className="navlink"
                aria-expanded={open === m.label}
                onClick={() =>
                  setOpen((o) => (o === m.label ? undefined : m.label))
                }
              >
                {m.label}
                <svg
                  className="caret"
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  aria-hidden="true"
                >
                  <path d="M1 3l4 4 4-4" />
                </svg>
              </button>
              {open === m.label && (
                <div className="dropdown" role="menu">
                  {m.items.map((it) => (
                    <a
                      key={it.label}
                      role="menuitem"
                      href={it.href}
                      {...(it.external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      onClick={() => setOpen(undefined)}
                    >
                      <span>
                        {it.label}
                        {it.external && <span aria-hidden="true"> ↗</span>}
                      </span>
                      {it.hint && <small>{it.hint}</small>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          <a
            className="navlink"
            href={`${REPO}#mirror-quota-of-a-real-fund`}
            target="_blank"
            rel="noreferrer"
          >
            Metodologia
          </a>
          <a
            className="navicon"
            href={REPO}
            target="_blank"
            rel="noreferrer"
            aria-label="Código no GitHub"
            title="Código no GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  );
}
