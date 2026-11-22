"use client";

import { useState } from "react";

type Props = {
  dates: { date: string; day: string; today: boolean }[];
  branches: { id: string; name: string }[];
  rows: { id: string; name: string; cells: string[] }[];
};

/** Barbers down, days across. Each cell is a plain select; changed cells are marked until saved. */
export function Grid({ dates, branches, rows }: Props) {
  const [values, setValues] = useState(
    () => new Map(rows.flatMap((r) => r.cells.map((c, i) => [`${r.id}:${i}`, c]))),
  );
  const original = (rowId: string, i: number) => rows.find((r) => r.id === rowId)?.cells[i] ?? "";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="label py-2 text-left font-medium">
              Barber
            </th>
            {dates.map((d) => (
              <th
                key={d.date}
                scope="col"
                className={`py-2 text-left font-medium ${d.today ? "text-fg" : "text-muted"}`}
              >
                {d.day} <span className="num">{d.date.slice(8)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-rule">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                {r.name}
              </th>
              {dates.map((d, i) => {
                const key = `${r.id}:${i}`;
                const value = values.get(key) ?? "";
                const changed = value !== original(r.id, i);
                return (
                  <td key={d.date} className="py-1.5 pr-1.5">
                    <select
                      name={`cell:${r.id}:${d.date}`}
                      aria-label={`${r.name}, ${d.day} ${d.date.slice(8)}`}
                      value={value}
                      onChange={(e) => {
                        const next = new Map(values);
                        next.set(key, e.currentTarget.value);
                        setValues(next);
                      }}
                      className={`min-h-10 w-full rounded-sm border bg-surface px-1.5 ${
                        changed ? "border-fg" : "border-rule"
                      } ${value === "off" ? "text-muted" : ""}`}
                    >
                      <option value="">—</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                      <option value="off">Libur</option>
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
