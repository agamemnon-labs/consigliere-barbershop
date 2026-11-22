import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "@/components/button";
import { Credits } from "@/components/credits";
import { Field } from "@/components/field";
import { PriceList } from "@/components/price-list";
import { Rule } from "@/components/rule";
import { TicketStub } from "@/components/ticket-stub";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "Lembar gaya",
  robots: { index: false },
};

const themes = [
  {
    id: "night",
    name: "Malam",
    use: "Web pelanggan di ponsel",
    tokens: [
      ["bg", "#15110E"],
      ["surface", "#1D1814"],
      ["fg", "#EBE3D4"],
      ["muted", "#A69B8B"],
      ["accent", "#6E1D1B"],
      ["accent-ink", "#C4665A"],
    ],
  },
  {
    id: "paper",
    name: "Kertas",
    use: "Kasir dan admin, jam kerja panjang",
    tokens: [
      ["bg", "#F3ECDF"],
      ["surface", "#FAF6EE"],
      ["fg", "#1B1613"],
      ["muted", "#675C50"],
      ["accent", "#6E1D1B"],
      ["accent-ink", "#7A2420"],
    ],
  },
  {
    id: "display",
    name: "Layar",
    use: "Tablet konter dan TV, kontras tinggi",
    tokens: [
      ["bg", "#0D0B09"],
      ["surface", "#171310"],
      ["fg", "#F6F0E5"],
      ["muted", "#C2B7A6"],
      ["accent", "#7A2420"],
      ["accent-ink", "#D77568"],
    ],
  },
] as const;

export default function StyleSheet() {
  return (
    <main>
      <header className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center">
        <p className="label">Lembar gaya · Fase 1</p>
        <h1 className="mt-6 text-5xl italic sm:text-6xl">Tukang jahit, bukan neon.</h1>
        <p className="mt-6 max-w-[46ch] text-muted">
          Hitam hangat, warna tulang, dan satu merah darah yang dipakai hemat. Serif untuk judul, sans polos
          untuk dibaca, angka tabular untuk antrean. Garis tipis, ruang lega.
        </p>
      </header>

      <Chapter n="01" title="Tiga tema">
        <div className="grid gap-4 sm:grid-cols-3">
          {themes.map((t) => (
            <div
              key={t.id}
              data-theme={t.id}
              className="flex flex-col rounded-sm border border-rule bg-bg p-5 text-fg"
            >
              <p className="font-display text-5xl leading-none">Aa</p>
              <p className="mt-6 font-display text-xl">{t.name}</p>
              <p className="mt-1 text-sm text-muted">{t.use}</p>
              <ul className="mt-6 grid gap-2">
                {t.tokens.map(([name, hex]) => (
                  <li key={name} className="flex items-center gap-3 text-sm">
                    <span
                      className="size-5 shrink-0 rounded-xs border border-rule-strong"
                      style={{ background: `var(--${name})` }}
                    />
                    <span className="text-muted">{name}</span>
                    <span className="leader" aria-hidden />
                    <span className="num text-xs">{hex}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter n="02" title="Huruf">
        <div className="grid gap-10">
          <Specimen name="Bodoni Moda" use="Judul. Bodoni lahir di Parma.">
            <p className="font-display text-6xl leading-none sm:text-7xl">Consigliere</p>
            <p className="mt-3 font-display text-3xl italic">Giliran Anda, Boss.</p>
          </Specimen>
          <Specimen name="Libre Franklin" use="Teks yang benar-benar dibaca.">
            <p className="max-w-[52ch] text-lg">
              Tidak perlu akun untuk antre. Cukup nama dan nomor WhatsApp, bayar dengan QRIS, lalu kami kabari
              saat dua orang lagi sebelum giliran Anda.
            </p>
            <p className="label mt-4">Label kecil · gaya kredit film</p>
          </Specimen>
          <Specimen name="IBM Plex Mono" use="Nomor antrean, harga, jam. Selalu tabular.">
            <p className="num text-4xl">J 014 · 14.40</p>
            <p className="num mt-2 text-lg text-muted">Rp80.000 Rp95.000 Rp110.000 Rp125.000</p>
          </Specimen>
        </div>
      </Chapter>

      <Chapter n="03" title="Tiket antrean">
        <div className="mx-auto grid max-w-sm gap-6">
          <TicketStub number={14} prefix="J" barber="Vito" branch="Juanda" waitMin={25} around="14.40" />
          <p className="text-center text-sm text-muted">
            Satu-satunya tempat merah darah dipakai sebagai warna angka. Sobekan dan lubangnya dipotong dengan
            mask, jadi warna halaman tembus.
          </p>
        </div>
      </Chapter>

      <Chapter n="04" title="Daftar harga">
        <div className="mx-auto max-w-md">
          <PriceList only={["haircut", "chemical"]} />
          <p className="mt-6 text-sm text-muted">
            Ketuk baris untuk membuka detail ke bawah. Tidak ada geser ke samping.
          </p>
        </div>
      </Chapter>

      <Chapter n="05" title="Tombol dan isian">
        <div className="mx-auto grid max-w-md gap-10">
          <div className="grid gap-3">
            <Button block>Ambil nomor</Button>
            <Button block variant="accent">
              Bayar <span className="num">Rp95.000</span>
            </Button>
            <Button block variant="quiet">
              Lihat barber lain
            </Button>
          </div>
          <div className="grid gap-8">
            <Field label="Nama" name="demo-name" defaultValue="Sonny" autoComplete="off" />
            <Field
              label="Nomor WhatsApp"
              name="demo-wa"
              inputMode="tel"
              defaultValue="0812 345"
              error="Nomor belum lengkap."
              autoComplete="off"
            />
          </div>
        </div>
      </Chapter>

      <Chapter n="06" title="Layar kasir" note="Tema kertas, desktop lebar, satu ketukan per aksi.">
        <CashierPreview />
      </Chapter>

      <Chapter n="07" title="Tablet konter" note="Tema layar, hanya tampilan, terbaca dari dua meter.">
        <TabletPreview />
      </Chapter>

      <div className="mt-24 flex justify-center">
        <Wordmark />
      </div>
      <Credits />
    </main>
  );
}

function Chapter({
  n,
  title,
  note,
  children,
}: {
  n: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-14" aria-labelledby={`ch-${n}`}>
      <Rule className="mb-10" />
      <header className="mb-10 flex flex-col items-center text-center">
        <span className="num text-xs text-faint">{n}</span>
        <h2 id={`ch-${n}`} className="mt-2 text-3xl">
          {title}
        </h2>
        {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Specimen({ name, use, children }: { name: string; use: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-rule pb-10 sm:grid-cols-[12rem_1fr]">
      <div>
        <p className="label text-fg">{name}</p>
        <p className="mt-1 text-sm text-muted">{use}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

const cashierColumns = [
  {
    barber: "Vito",
    level: "Executive",
    now: { no: "J 011", name: "Pak Bram", since: "14.05" },
    queue: [
      { no: "J 014", name: "Sonny", src: "online", wait: 25 },
      { no: "J 016", name: "Walk-in", src: "walkin", wait: 55 },
    ],
  },
  {
    barber: "Paulie",
    level: "Senior",
    now: { no: "J 012", name: "Rizal", since: "14.12" },
    queue: [{ no: "J 015", name: "Andi", src: "walkin", wait: 18 }],
  },
  {
    barber: "Tommy",
    level: "Regular",
    now: null,
    queue: [],
  },
];

function CashierPreview() {
  return (
    <div data-theme="paper" className="rounded-sm border border-rule bg-bg p-4 text-fg sm:p-6">
      <div className="mb-5 flex items-baseline justify-between border-b border-rule pb-4">
        <p className="font-display text-xl">
          Juanda <span className="text-muted italic">· Minggu, 22 Nov</span>
        </p>
        <p className="num text-sm text-muted">14.22</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cashierColumns.map((c) => (
          <div key={c.barber} className="flex flex-col rounded-sm border border-rule bg-surface">
            <div className="flex items-baseline justify-between border-b border-rule px-4 py-3">
              <p className="font-display text-xl">{c.barber}</p>
              <p className="label">{c.level}</p>
            </div>
            <div className="border-b border-rule px-4 py-3">
              <p className="label">Sedang dipotong</p>
              {c.now ? (
                <div className="mt-2 flex items-baseline justify-between">
                  <p>
                    <span className="num mr-2 text-accent-ink">{c.now.no}</span>
                    {c.now.name}
                  </p>
                  <p className="num text-sm text-muted">sejak {c.now.since}</p>
                </div>
              ) : (
                <p className="mt-2 text-muted italic">Kursi kosong</p>
              )}
              {c.now ? (
                <Button variant="primary" block className="mt-3 min-h-11">
                  Selesai
                </Button>
              ) : null}
            </div>
            <ol className="flex-1 px-4 py-2">
              {c.queue.map((q, i) => (
                <li
                  key={q.no}
                  className="flex items-center justify-between gap-3 border-b border-rule py-3 last:border-0"
                >
                  <div>
                    <p>
                      <span className="num mr-2">{q.no}</span>
                      {q.name}
                    </p>
                    <p className="label mt-1">
                      {q.src === "online" ? "Online · lunas" : "Walk-in"} · ± {q.wait} mnt
                    </p>
                  </div>
                  {i === 0 ? (
                    <Button variant="accent" className="min-h-11 px-4">
                      Panggil
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="min-h-12 border-t border-rule text-sm font-medium tracking-[0.02em] text-muted hover:bg-bg hover:text-fg"
            >
              + Walk-in
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabletPreview() {
  const rows = [
    { barber: "Vito", now: "J 011", next: "J 014", wait: 25 },
    { barber: "Paulie", now: "J 012", next: "J 015", wait: 18 },
    { barber: "Tommy", now: null, next: null, wait: 0 },
  ];
  return (
    <div data-theme="display" className="rounded-sm bg-bg px-6 py-8 text-fg sm:px-10">
      <div className="flex items-baseline justify-between border-b border-rule-strong pb-4">
        <p className="font-display text-2xl uppercase tracking-[0.14em]">Juanda</p>
        <p className="num text-2xl">14.22</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-6 sm:gap-x-12">
        <p className="label py-3">Barber</p>
        <p className="label py-3 text-right">Sekarang</p>
        <p className="label py-3 text-right">Berikutnya</p>
        {rows.map((r) => (
          <div key={r.barber} className="contents">
            <p className="border-t border-rule py-5 font-display text-3xl sm:text-4xl">{r.barber}</p>
            <p className="num border-t border-rule py-5 text-right text-3xl text-accent-ink sm:text-4xl">
              {r.now ?? "—"}
            </p>
            <div className="border-t border-rule py-5 text-right">
              {r.next ? (
                <>
                  <p className="num text-3xl sm:text-4xl">{r.next}</p>
                  <p className="num mt-1 text-sm text-muted">± {r.wait} mnt</p>
                </>
              ) : (
                <p className="text-xl text-muted italic">Langsung duduk</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
