export interface Day {
  date: string;
  quota: string;
  change_pct: string | null;
  reconciled: boolean;
}

export interface Position {
  ticker: string;
  quantity: string;
  average_cost: string;
  price: string;
  market_value: string;
  unrealized_pnl: string;
  stale_price: boolean;
}

export interface Portfolio {
  date: string;
  quota: string;
  net_asset_value: string;
  closing_net_asset_value: string;
  cash: string;
  shares_outstanding: string;
  realized_pnl: string;
  notes: string[];
  positions: Position[];
}

export interface ReconLine {
  item: string;
  ours: string | null;
  theirs: string | null;
  difference: string | null;
  status: "match" | "break" | "missing";
}

export interface Reconciliation {
  date: string;
  matched: boolean;
  lines: ReconLine[];
  causes: string[];
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  days: () => get<{ fund: string; days: Day[] }>("/api/days"),
  portfolio: (day: string) => get<Portfolio>(`/api/portfolio/${day}`),
  reconciliation: (day: string) => get<Reconciliation>(`/api/reconciliation/${day}`),
};
