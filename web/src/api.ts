export interface Day {
  date: string;
  quota: string;
  change_pct: string | null;
  return_pct: string;
  net_asset_value: string;
  closing_net_asset_value: string;
  subscriptions: string;
  redemptions: string;
  reconciled: boolean;
}

export interface Fund {
  name: string;
  kind: string;
  tags: string[];
  administrator: string;
  manager: string;
  custodian: string;
  quota_rule: string;
  subscription_settlement: string;
  redemption_settlement: string;
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
  fund: () => get<Fund>("/api/fund"),
  days: () => get<{ fund: string; days: Day[] }>("/api/days"),
  portfolio: (day: string) => get<Portfolio>(`/api/portfolio/${day}`),
  reconciliation: (day: string) =>
    get<Reconciliation>(`/api/reconciliation/${day}`),
};

export interface RealSummary {
  slug: string;
  name: string;
  cnpj: string;
  last_date: string | null;
  official_quota: string | null;
  net_asset_value: string | null;
  gap_bps: string | null;
  flagged_days: number;
}

export interface MirrorDay {
  date: string;
  official_quota: string;
  our_quota: string;
  official_return_pct: string;
  our_return_pct: string;
  gap_bps: string;
  gap_change_bps: string | null;
  net_asset_value: string;
  subscriptions: string;
  redemptions: string;
  holders: number;
  stale: string[];
  flagged: boolean;
  explanation: string | null;
  movers: { ticker: string; return_pct: string; contribution_bps: string }[];
}

export interface RealFund {
  info: {
    name: string;
    cnpj: string;
    portfolio_date: string;
    sources: Record<string, string>;
    fetched: string;
  };
  start: string;
  start_nav: string;
  shares: string;
  other_assets: string;
  check: {
    stocks: number;
    ours: string;
    administrator: string;
    mismatches: { ticker: string; difference: string | null }[];
  };
  holdings: {
    ticker: string;
    quantity: string;
    close: string | null;
    market_value: string;
    weight_pct: string;
  }[];
  days: MirrorDay[];
}

export const realApi = {
  list: () => get<{ funds: RealSummary[] }>("/api/real"),
  fund: (slug: string) =>
    get<RealFund>(`/api/real/${encodeURIComponent(slug)}`),
};
