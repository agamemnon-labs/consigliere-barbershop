import { describe, expect, it } from "vitest";
import { addDays, shopClock, shopDate, weekday } from "./time";

describe("shop time (WITA)", () => {
  it("rolls over to the next day at 16:00 UTC", () => {
    expect(shopDate(new Date("2026-11-22T15:59:00Z"))).toBe("2026-11-22");
    expect(shopDate(new Date("2026-11-22T16:00:00Z"))).toBe("2026-11-23");
  });
  it("formats clock time the Indonesian way", () => {
    expect(shopClock(new Date("2026-11-22T06:40:00Z"))).toBe("14.40");
  });
  it("does calendar maths on plain dates", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekday("2026-11-22")).toBe(0);
  });
});
