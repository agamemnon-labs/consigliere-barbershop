import { describe, expect, it } from "vitest";
import { barberWeek, daysOff, onDuty, type Shift, shortDate } from "./schedule";

const shifts: Shift[] = [
  { barberId: "vito", date: "2026-11-22", status: "on", branchId: "pulau-kalimantan" },
  { barberId: "vito", date: "2026-11-23", status: "off", branchId: null },
  { barberId: "vito", date: "2026-11-24", status: "on", branchId: "citra-niaga" },
  { barberId: "sonny", date: "2026-11-22", status: "on", branchId: "pulau-kalimantan" },
  { barberId: "tony", date: "2026-11-22", status: "on", branchId: "citra-niaga" },
];

describe("barberWeek", () => {
  it("follows the rotation, days off and unplanned days", () => {
    const week = barberWeek("vito", shifts, [], "2026-11-22", 4);
    expect(week.map((d) => d.kind)).toEqual(["working", "off", "working", "unknown"]);
    expect(week[2]).toMatchObject({ branchId: "citra-niaga" });
  });
  it("marks a working day at a closed branch as closed", () => {
    const week = barberWeek(
      "vito",
      shifts,
      [{ branchId: null, date: "2026-11-24", reason: "Natal" }],
      "2026-11-22",
      3,
    );
    expect(week[2]).toMatchObject({ kind: "closed", reason: "Natal" });
  });
});

describe("onDuty", () => {
  it("lists barbers working at a branch that day", () => {
    expect(onDuty(shifts, [], "pulau-kalimantan", "2026-11-22")).toEqual(["vito", "sonny"]);
  });
  it("is empty when the branch is closed", () => {
    expect(
      onDuty(
        shifts,
        [{ branchId: "pulau-kalimantan", date: "2026-11-22", reason: "Lebaran" }],
        "pulau-kalimantan",
        "2026-11-22",
      ),
    ).toEqual([]);
  });
});

describe("labels", () => {
  it("names days off and formats short dates in Indonesian", () => {
    expect(daysOff(barberWeek("vito", shifts, [], "2026-11-22", 3))).toEqual(["Senin"]);
    expect(shortDate("2026-11-23")).toBe("Sen, 23 Nov");
  });
});
