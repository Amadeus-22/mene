import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDecimal,
  formatMoney,
  formatQuantity,
  itemLabel,
  sign,
} from "./format";

describe("format", () => {
  it("groups thousands and uses a decimal comma without float rounding", () => {
    expect(formatDecimal("1091688.79")).toBe("1.091.688,79");
    expect(formatDecimal("1.02053713")).toBe("1,02053713");
    expect(formatDecimal("12345678901234567890.12")).toBe(
      "12.345.678.901.234.567.890,12",
    );
  });
  it("keeps the sign and pads to fixed places", () => {
    expect(formatMoney("-0.5")).toBe("R$\u00a0-0,50");
    expect(formatMoney("950")).toBe("R$\u00a0950,00");
  });
  it("drops trailing zeros from quantities", () => {
    expect(formatQuantity("16000.00000000")).toBe("16.000");
    expect(formatQuantity("0.0")).toBe("0");
    expect(formatQuantity("7000")).toBe("7.000");
    expect(formatQuantity("1.50")).toBe("1,5");
  });
  it("classifies changes", () => {
    expect(sign("0.0000")).toBe("flat");
    expect(sign("-0.3412")).toBe("down");
    expect(sign("1.2")).toBe("up");
    expect(sign(null)).toBe("flat");
  });
  it("labels dates and reconciliation items", () => {
    expect(formatDate("2026-03-10")).toBe("10/03/2026");
    expect(itemLabel("POSITION:BETA4")).toBe("Posição BETA4");
    expect(itemLabel("NAV")).toBe("PL");
  });
});
