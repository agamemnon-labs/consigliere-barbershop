import { describe, expect, it } from "vitest";
import { normalizePhone } from "./booking";
import {
  type AlertCandidate,
  aheadPhrase,
  DAILY_CAP,
  dueNearAlerts,
  nearTurnBody,
  nearTurnParams,
  otpBody,
  parseAllowlist,
  shortLineAtJoin,
  underDailyCap,
} from "./notify";

const entry = (id: string, position: number, over: Partial<AlertCandidate> = {}): AlertCandidate => ({
  id,
  position,
  status: "waiting",
  calledAt: null,
  graceUntil: null,
  startedAt: null,
  lateMoves: 0,
  estimatedMin: 30,
  nearAlertAt: null,
  phone: "6281234567890",
  ...over,
});

describe("the 'your turn is near' alert", () => {
  it("goes to everyone waiting with two or fewer ahead, chair included", () => {
    const line = [
      entry("a", 1, { status: "in_service", startedAt: new Date() }),
      entry("b", 2),
      entry("c", 3),
      entry("d", 4),
    ];
    expect(dueNearAlerts(line).map((x) => [x.entry.id, x.ahead])).toEqual([
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("goes once, only with a number, and never to someone already called", () => {
    const line = [
      entry("a", 1, { status: "called" }),
      entry("b", 2, { nearAlertAt: new Date() }),
      entry("c", 3, { phone: null }),
      entry("d", 4),
    ];
    expect(dueNearAlerts(line)).toEqual([]);
  });

  it("ignores people who left the line", () => {
    const line = [entry("a", 1, { status: "done" }), entry("b", 2, { status: "cancelled" }), entry("c", 3)];
    expect(dueNearAlerts(line).map((x) => [x.entry.id, x.ahead])).toEqual([["c", 0]]);
  });

  it("skips someone who joins an already short line", () => {
    expect(shortLineAtJoin(0)).toBe(true);
    expect(shortLineAtJoin(2)).toBe(true);
    expect(shortLineAtJoin(3)).toBe(false);
  });

  it("reads naturally for every distance", () => {
    expect(aheadPhrase(2)).toBe("tinggal 2 orang lagi");
    expect(aheadPhrase(1)).toBe("tinggal 1 orang lagi");
    expect(aheadPhrase(0)).toBe("kamu berikutnya");
    const facts = { name: "Sari", branch: "Citra Niaga", ahead: 2, ticket: "C 014" };
    expect(nearTurnParams(facts)).toEqual(["Sari", "Citra Niaga", "tinggal 2 orang lagi", "C 014"]);
    expect(nearTurnBody("Consigliere", facts)).toBe(
      "Halo Sari, giliranmu di Consigliere Citra Niaga sudah dekat: tinggal 2 orang lagi. Nomor antreanmu C 014. Yuk mulai jalan ke sini.",
    );
  });
});

describe("message safety", () => {
  it("never puts the code in the log copy", () => {
    expect(otpBody("Consigliere")).not.toMatch(/\d{6}/);
  });

  it("caps real messages per number per day", () => {
    expect(underDailyCap(DAILY_CAP - 1)).toBe(true);
    expect(underDailyCap(DAILY_CAP)).toBe(false);
  });

  it("reads an allowlist in any common spelling", () => {
    expect([...parseAllowlist("0812-3456-7890, +6281111111111 junk", normalizePhone)]).toEqual([
      "6281234567890",
      "6281111111111",
    ]);
    expect(parseAllowlist(undefined, normalizePhone).size).toBe(0);
  });
});
