import { describe, expect, it } from "vitest";
import {
  activeEntries,
  call,
  callable,
  cancel,
  estimates,
  finish,
  late,
  nextPosition,
  type QueueEntry,
  QueueError,
  start,
  ticketLabel,
  waitForNewcomer,
} from "./queue";

const t0 = new Date("2026-11-23T06:00:00Z");
const min = (m: number) => new Date(t0.getTime() + m * 60_000);

function entry(id: string, position: number, over: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id,
    position,
    status: "waiting",
    calledAt: null,
    graceUntil: null,
    startedAt: null,
    lateMoves: 0,
    estimatedMin: 30,
    ...over,
  };
}

function apply(entries: QueueEntry[], patches: ReturnType<typeof call>): QueueEntry[] {
  return entries.map((e) => {
    const p = patches.find((x) => x.id === e.id);
    return p ? { ...e, ...p } : e;
  });
}

describe("ordering", () => {
  it("puts the person in the chair first, then the line by position", () => {
    const q = [entry("c", 3), entry("a", 1, { status: "done" }), entry("b", 2, { status: "in_service" })];
    expect(activeEntries(q).map((e) => e.id)).toEqual(["b", "c"]);
    expect(nextPosition(q)).toBe(4);
    expect(nextPosition([])).toBe(1);
  });
});

describe("calling and serving", () => {
  it("calls the front of the line with a five-minute grace", () => {
    const q = [entry("a", 1), entry("b", 2)];
    const [p] = call(q, "a", t0, 5);
    expect(p).toMatchObject({ status: "called", calledAt: t0, graceUntil: min(5) });
    expect(() => call(q, "b", t0, 5)).toThrow(QueueError);
  });

  it("calls one person at a time", () => {
    const q = apply([entry("a", 1), entry("b", 2)], call([entry("a", 1), entry("b", 2)], "a", t0, 5));
    expect(callable(q)).toBeUndefined();
  });

  it("seats a called customer, then finishes them", () => {
    let q = [entry("a", 1, { status: "called", calledAt: t0, graceUntil: min(5) })];
    q = apply(q, start(q, "a", min(2)));
    expect(q[0]).toMatchObject({ status: "in_service", startedAt: min(2) });
    q = apply(q, finish(q, "a", min(30)));
    expect(q[0]?.status).toBe("done");
  });

  it("lets the front walk-in sit straight down when the chair is free", () => {
    const q = [entry("a", 1), entry("b", 2)];
    expect(start(q, "a", t0)[0]).toMatchObject({ status: "in_service" });
    expect(() => start(q, "b", t0)).toThrow(QueueError);
  });

  it("never seats two people at once", () => {
    const q = [entry("a", 1, { status: "in_service", startedAt: t0 }), entry("b", 2, { status: "called" })];
    expect(() => start(q, "b", t0)).toThrow(/Kursi masih terisi/);
  });
});

describe("late customers", () => {
  const called = (id: string, pos: number, lateMoves = 0) =>
    entry(id, pos, { status: "called", calledAt: t0, graceUntil: min(5), lateMoves });

  it("waits out the grace period first", () => {
    expect(() => late([called("a", 1)], "a", min(4))).toThrow(/waktu tunggu/);
  });

  it("moves a late customer back exactly one place", () => {
    const q = [called("a", 1), entry("b", 2), entry("c", 3)];
    const after = apply(q, late(q, "a", min(5)));
    expect(activeEntries(after).map((e) => e.id)).toEqual(["b", "a", "c"]);
    expect(after.find((e) => e.id === "a")).toMatchObject({
      status: "waiting",
      lateMoves: 1,
      calledAt: null,
    });
  });

  it("keeps a late customer in place when nobody is behind", () => {
    const q = [called("a", 1)];
    expect(late(q, "a", min(5))).toEqual([
      { id: "a", status: "waiting", calledAt: null, graceUntil: null, lateMoves: 1 },
    ]);
  });

  it("makes it a no-show when they are absent at the second call", () => {
    expect(late([called("a", 2, 1)], "a", min(6))).toEqual([{ id: "a", status: "no_show" }]);
  });
});

describe("cancel", () => {
  it("cancels waiting or called entries only", () => {
    expect(cancel([entry("a", 1)], "a")).toEqual([{ id: "a", status: "cancelled" }]);
    expect(() => cancel([entry("a", 1, { status: "in_service" })], "a")).toThrow(QueueError);
  });
});

describe("estimates", () => {
  it("adds up the work ahead, counting what is left of the current cut", () => {
    const q = [
      entry("a", 1, { status: "in_service", startedAt: t0 }),
      entry("b", 2, { estimatedMin: 60 }),
      entry("c", 3),
    ];
    const est = estimates(q, min(10));
    expect(est.get("a")).toEqual({ ahead: 0, waitMin: 0 });
    expect(est.get("b")).toEqual({ ahead: 1, waitMin: 20 });
    expect(est.get("c")).toEqual({ ahead: 2, waitMin: 80 });
    expect(waitForNewcomer(q, min(10))).toBe(110);
  });

  it("assumes five more minutes when a cut runs over", () => {
    const q = [entry("a", 1, { status: "in_service", startedAt: t0 }), entry("b", 2)];
    expect(estimates(q, min(45)).get("b")?.waitMin).toBe(5);
  });
});

describe("ticketLabel", () => {
  it("pads the daily number", () => {
    expect(ticketLabel("J", 14)).toBe("J 014");
  });
});
