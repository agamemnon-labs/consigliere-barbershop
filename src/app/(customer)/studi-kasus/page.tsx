import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { ButtonLink } from "@/components/button";
import { Credits } from "@/components/credits";
import { Rule } from "@/components/rule";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Studi kasus",
  description: `Bagaimana ${brand.builtBy.name} membangun antrean, booking, dan member untuk ${brand.name}.`,
};

const surfaces = [
  {
    title: "Pelanggan",
    where: "HP",
    what: "Lihat harga dan barber, ambil nomor, bayar QRIS, pantau giliran",
  },
  { title: "Kasir", where: "Desktop", what: "Papan antrean per barber, panggil, bayar di EDC, struk" },
  { title: "Tablet toko", where: "Layar", what: "Nomor yang dipanggil, tanpa nama pelanggan" },
  { title: "Back office", where: "Pemilik", what: "Laporan, komisi, rotasi barber, harga, member" },
];

const decisions = [
  [
    "Bayar dulu, lalu antre",
    "Booking online masuk antrean yang sama dengan walk-in. Tidak ada jam pasti, jadi tidak ada kursi kosong karena orang tidak datang.",
  ],
  [
    "Uang tidak pernah hilang",
    "Bayar setelah waktunya habis jadi kredit 30 hari. Saldo dan poin dicatat sebagai buku besar, bukan angka yang ditimpa.",
  ],
  [
    "Komisi yang adil",
    "Dihitung dari harga setelah diskon, dengan level barber di hari penjualan. Naik level tidak mengubah komisi bulan lalu.",
  ],
  ["Privasi di toko", "Layar tablet hanya menampilkan nomor. Kasir tidak pernah tahu PIN member."],
  ["Semua waktu WITA", "Hari, jam buka, dan laporan selalu memakai waktu Samarinda."],
] as const;

const stack = [
  "Next.js 16 dan React 19, satu aplikasi untuk semua layar",
  "Postgres di Supabase dengan Drizzle, RLS di setiap tabel",
  "Better Auth: email untuk staf, nomor WhatsApp dan PIN untuk member",
  "QRIS lewat Xendit, dengan mode demo tanpa uang sungguhan",
  "Aturan bisnis sebagai fungsi murni yang dites, plus tes ujung ke ujung di Playwright",
];

/** The portfolio write-up: what was built, why, and the decisions behind it. */
export default function CaseStudyPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/">Beranda</BackLink>
      <header className="pt-10 pb-12">
        <p className="label">Studi kasus · {brand.builtBy.name}</p>
        <h1 className="mt-3 text-5xl leading-[1.05]">{brand.name}</h1>
        <p className="mt-4 text-muted">Antrean, booking, dan member untuk barbershop tiga cabang</p>
      </header>

      <Rule label="Masalahnya" />
      <p className="mt-6 text-[1.0625rem] leading-relaxed">
        Pelanggan datang lalu menunggu tanpa tahu berapa lama. Harga ditanya ke kasir. Barber bergiliran antar
        cabang, jadi tidak ada yang tahu siapa jaga di mana.
      </p>

      <Rule label="Satu aplikasi, empat layar" className="mt-14" />
      <ul className="mt-4">
        {surfaces.map((s) => (
          <li key={s.title} className="border-b border-rule py-4">
            <p className="flex items-baseline justify-between gap-4">
              <span className="font-display text-xl">{s.title}</span>
              <span className="label">{s.where}</span>
            </p>
            <p className="mt-1 text-[0.9375rem] text-muted">{s.what}</p>
          </li>
        ))}
      </ul>

      <Rule label="Keputusan yang penting" className="mt-14" />
      <ul className="mt-4 border-t border-rule">
        {decisions.map(([title, body]) => (
          <li key={title} className="border-b border-rule">
            <details className="row">
              <summary className="flex min-h-14 items-center justify-between gap-4 py-3">
                <span className="text-[1.0625rem]">{title}</span>
                <span aria-hidden className="row-mark inline-block w-3 text-center text-muted">
                  +
                </span>
              </summary>
              <p className="pr-7 pb-5 text-[0.9375rem] text-muted">{body}</p>
            </details>
          </li>
        ))}
      </ul>

      <Rule label="Dibangun dengan" className="mt-14" />
      <ul className="mt-6 grid gap-3 text-[0.9375rem]">
        {stack.map((line) => (
          <li key={line} className="flex gap-3">
            <span aria-hidden className="text-faint">
              —
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <Rule label="Rupa" className="mt-14" />
      <p className="mt-6 text-[1.0625rem] leading-relaxed">
        Toko jahit tua dan kredit film tahun 70-an. Satu warna aksen, huruf Bodoni, angka yang rata. Tiap
        layar punya satu tugas.
      </p>

      <div className="mt-14 grid gap-3">
        <ButtonLink href="/demo" block>
          Coba demo
        </ButtonLink>
        <ButtonLink href={brand.builtBy.repo} variant="quiet" block>
          Lihat kode
        </ButtonLink>
      </div>
      <Credits />
    </div>
  );
}
