import { describe, expect, it } from "vitest";
import { formatAverage, parseScore, summarizeRatings } from "./rating";

describe("parseScore", () => {
  it("takes whole numbers 1 to 5, from numbers or form strings", () => {
    expect(parseScore(1)).toBe(1);
    expect(parseScore("5")).toBe(5);
  });
  it("rejects anything else", () => {
    for (const v of [0, 6, 4.5, "", " ", "abc", null, undefined, Number.NaN, "10"]) {
      expect(parseScore(v)).toBeNull();
    }
  });
});

describe("summarizeRatings", () => {
  it("averages per barber to one decimal and counts each score", () => {
    const out = summarizeRatings([
      { barberId: "vito", score: 5 },
      { barberId: "vito", score: 4 },
      { barberId: "vito", score: 5 },
      { barberId: "sal", score: 3 },
    ]);
    expect(out).toEqual([
      { barberId: "vito", count: 3, average: 4.7, spread: [0, 0, 0, 1, 2] },
      { barberId: "sal", count: 1, average: 3, spread: [0, 0, 1, 0, 0] },
    ]);
  });
  it("puts the barber with more ratings first on a tie", () => {
    const out = summarizeRatings([
      { barberId: "a", score: 4 },
      { barberId: "b", score: 4 },
      { barberId: "b", score: 4 },
    ]);
    expect(out.map((r) => r.barberId)).toEqual(["b", "a"]);
  });
  it("skips scores outside 1 to 5", () => {
    expect(summarizeRatings([{ barberId: "a", score: 9 }])).toEqual([]);
  });
});

describe("formatAverage", () => {
  it("writes one decimal with a comma", () => {
    expect(formatAverage(4.7)).toBe("4,7");
    expect(formatAverage(3)).toBe("3,0");
  });
});
