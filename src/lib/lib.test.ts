import { toCsv, csvField, downloadCsv } from "./csv";
import { addDays, dateRange, daysBetween, formatShortDay, todayInParaguay } from "./dates";
import { formatNumber, formatPYG, parseGuaraniesInput, parseMoney } from "./money";

const normalize = (s: string) => s.replace(/\s/g, " ");

describe("PYG formatting", () => {
  it.each([
    [0, "Gs. 0"],
    [18500, "Gs. 18.500"],
    [1234567, "Gs. 1.234.567"],
    [18500.6, "Gs. 18.501"],
  ])("formats %d as %s", (amount, expected) => {
    expect(normalize(formatPYG(amount))).toBe(expected);
  });

  it("never shows decimals", () => {
    expect(formatPYG(99.99)).not.toMatch(/,\d/);
    expect(formatNumber(1234567)).toBe("1.234.567");
  });

  it("parses API decimal strings into whole guaraníes", () => {
    expect(parseMoney("18500.00")).toBe(18500);
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("-5000.00")).toBe(-5000);
    expect(() => parseMoney("1e5")).toThrow(TypeError);
    expect(() => parseMoney("abc")).toThrow(TypeError);
  });

  it.each([
    ["18500", 18500],
    ["18.500", 18500],
    ["Gs. 1.234.567", 1234567],
    [" 2 500 ", 2500],
    ["18,5", null],
    ["-10", null],
    ["", null],
    ["99999999999999999999", null],
  ])("parses user input %j", (input, expected) => {
    expect(parseGuaraniesInput(input)).toBe(expected);
  });
});

describe("dates", () => {
  it("computes ranges and offsets on calendar dates", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysBetween("2026-01-01", "2026-01-15")).toBe(14);
    expect(dateRange("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(formatShortDay("2026-10-05")).toBe("05/10");
  });

  it("uses Paraguay's calendar day", () => {
    // 01:30 UTC is still the previous evening in Asunción (UTC-3).
    expect(todayInParaguay(new Date("2026-10-23T01:30:00Z"))).toBe("2026-10-22");
  });
});

describe("CSV", () => {
  it("escapes separators, quotes and line breaks", () => {
    expect(csvField('Termo "acero", 1 L')).toBe('"Termo ""acero"", 1 L"');
    expect(csvField("línea\nnueva")).toBe('"línea\nnueva"');
    expect(csvField(null)).toBe("");
    expect(csvField(18500)).toBe("18500");
    expect(
      toCsv([
        ["a", "b"],
        [1, 2],
      ]),
    ).toBe("a,b\r\n1,2");
  });

  it("neutralises formula injection in text cells", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField(-5)).toBe("-5");
  });

  it("downloads a UTF-8 file with BOM", async () => {
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:csv";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadCsv("ventas.csv", [["Día", "Ingresos"]]);

    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    const bytes = new Uint8Array(await created[0]!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe("Día,Ingresos");
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
