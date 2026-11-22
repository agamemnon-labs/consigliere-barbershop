import { describe, expect, it } from "vitest";
import {
  checkRange,
  commissions,
  copyWeek,
  groupBy,
  levelOn,
  mondayOf,
  type SaleLine,
  toCsv,
  weekDates,
} from "./report.ts";

const line = (p: Partial<SaleLine>): SaleLine => ({
  date: "2026-11-20",
  branchId: "j",
  barberId: "b1",
  serviceId: "h",
  name: "Haircut",
  category: "haircut",
  amount: 100_000,
  source: "counter",
  ...p,
});

describe("grouping", () => {
  it("sums and sorts biggest first", () => {
    const out = groupBy(
      [line({}), line({ branchId: "p", amount: 300_000 }), line({ amount: 50_000 })],
      (l) => l.branchId,
    );
    expect(out).toEqual([
      { key: "p", count: 1, amount: 300_000 },
      { key: "j", count: 2, amount: 150_000 },
    ]);
  });
});

describe("commission", () => {
  const history = [
    { barberId: "b1", levelId: "regular", effectiveFrom: "2026-01-01" },
    { barberId: "b1", levelId: "senior", effectiveFrom: "2026-11-21" },
  ];
  const rule = { haircutBps: { regular: 4000, senior: 5000 }, otherBps: 3000 };

  it("uses the level on the day of the sale", () => {
    expect(levelOn(history, "b1", "2026-11-20")).toBe("regular");
    expect(levelOn(history, "b1", "2026-11-21")).toBe("senior");
    expect(levelOn(history, "b2", "2026-11-21")).toBeNull();
  });

  it("pays haircut by level, the rest at the flat share, rounded down", () => {
    const out = commissions(
      [
        line({}),
        line({ date: "2026-11-22" }),
        line({ category: "chemical", amount: 333_333 }),
        line({ barberId: null }),
      ],
      history,
      rule,
    );
    expect(out).toEqual([
      { barberId: "b1", sales: 533_333, services: 3, commission: 40_000 + 50_000 + 99_999 },
    ]);
  });
});

describe("csv", () => {
  it("quotes only what needs it", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["Curly Perm, Pendek", 5],
          ['Kata "x"', 1],
        ],
      ),
    ).toBe('a,b\r\n"Curly Perm, Pendek",5\r\n"Kata ""x""",1');
  });
});

describe("rotation week", () => {
  it("finds the Monday and the seven days", () => {
    expect(mondayOf("2026-11-22")).toBe("2026-11-16"); // a Sunday
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(weekDates("2026-11-23").at(-1)).toBe("2026-11-29");
  });

  it("copies last week forward", () => {
    const out = copyWeek(
      [
        { barberId: "b1", date: "2026-11-16", value: "j" },
        { barberId: "b1", date: "2026-11-23", value: "p" },
      ],
      "2026-11-16",
    );
    expect(out).toEqual([{ barberId: "b1", date: "2026-11-23", value: "j" }]);
  });
});

describe("date range", () => {
  it("rejects nonsense", () => {
    expect(checkRange("2026-11-01", "2026-11-30")).toBeNull();
    expect(checkRange("2026-11-30", "2026-11-01")).toMatch("setelah");
    expect(checkRange("2024-01-01", "2026-01-01")).toMatch("Maksimal");
    expect(checkRange("x", "2026-01-01")).toMatch("belum benar");
  });
});
