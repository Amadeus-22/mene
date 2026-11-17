/**
 * Formats decimal strings from the API in Brazilian style without ever turning
 * them into JavaScript numbers, so no precision is lost on the way to the screen.
 */
export function formatDecimal(value: string, places?: number): string {
  const negative = value.startsWith("-");
  const [int, frac = ""] = (negative ? value.slice(1) : value).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  let decimals = frac;
  if (places !== undefined)
    decimals = frac.padEnd(places, "0").slice(0, places);
  return `${negative ? "-" : ""}${grouped}${decimals ? `,${decimals}` : ""}`;
}

export function formatMoney(value: string): string {
  return `R$\u00a0${formatDecimal(value, 2)}`; // no-break space keeps "R$" with the number
}

export function formatQuantity(value: string): string {
  const trimmed = value.includes(".")
    ? value.replace(/0+$/, "").replace(/\.$/, "")
    : value;
  return formatDecimal(trimmed || "0");
}

export function sign(value: string | null): "up" | "down" | "flat" {
  if (value === null || /^-?0(\.0*)?$/.test(value)) return "flat";
  return value.startsWith("-") ? "down" : "up";
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const ITEM_LABELS: Record<string, string> = { QUOTA: "Cota", NAV: "PL" };

export function itemLabel(item: string): string {
  return ITEM_LABELS[item] ?? item.replace("POSITION:", "Posição ");
}
