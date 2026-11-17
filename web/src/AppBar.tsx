import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";

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
        href: "#/datasets?fonte=cvm-cda",
      },
      {
        label: "CVM · Informe diário",
        href: "#/datasets?fonte=cvm-informe",
      },
      {
        label: "B3 · Cotações históricas",
        href: "#/datasets?fonte=b3-cotahist",
      },
      {
        label: "Banco Central · CDI (SGS 12)",
        href: "#/datasets?fonte=bcb-cdi",
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
        <a className="brand" href="#/inicio" aria-label="Mene, início">
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
            href="#/metodologia"
            aria-current={route === "methodology" ? "page" : undefined}
          >
            Metodologia
          </a>
        </nav>
      </div>
    </header>
  );
}
