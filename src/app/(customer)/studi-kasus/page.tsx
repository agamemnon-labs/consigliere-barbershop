import type { Metadata } from "next";
import { ButtonLink } from "@/components/button";
import {
  ChartIcon,
  CheckIcon,
  ChevronDownIcon,
  MonitorIcon,
  TicketIcon,
  WalletIcon,
} from "@/components/icons";
import { Screen } from "@/components/screen";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Studi kasus",
  description: `Bagaimana ${brand.builtBy.name} membangun antrean, booking, dan member untuk ${brand.name}.`,
};

const surfaces = [
  {
    title: "Pelanggan",
    where: "HP",
    what: "Lihat antrean, ambil nomor, bayar QRIS, pantau giliran",
    icon: TicketIcon,
    tile: "bg-accent text-accent-fg",
  },
  {
    title: "Kasir",
    where: "Desktop",
    what: "Papan antrean per barber, panggil, bayar, struk",
    icon: WalletIcon,
    tile: "bg-butter text-butter-ink",
  },
  {
    title: "Tablet toko",
    where: "Layar",
    what: "Nomor yang dipanggil, tanpa nama pelanggan",
    icon: MonitorIcon,
    tile: "bg-mint text-mint-ink",
  },
  {
    title: "Back office",
    where: "Pemilik",
    what: "Laporan, komisi, rotasi barber, harga, member",
    icon: ChartIcon,
    tile: "bg-blue-soft text-blue",
  },
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
    <Screen back={{ href: "/", label: "Beranda" }}>
      <p className="label">Studi kasus oleh {brand.builtBy.name}</p>
      <h1 className="wide mt-2 text-[2rem] uppercase leading-none tracking-[0.02em]">{brand.name}</h1>
      <p className="mt-3 text-lg">Antrean, booking, dan member untuk barbershop tiga cabang</p>

      <h2 className="mt-10 text-xl">Masalahnya</h2>
      <p className="mt-2 text-[1.0625rem] leading-relaxed text-muted">
        Pelanggan datang lalu menunggu tanpa tahu berapa lama. Harga ditanya ke kasir. Barber bergiliran antar
        cabang, jadi tidak ada yang tahu siapa jaga di mana.
      </p>

      <h2 className="mt-10 text-xl">Satu aplikasi, empat layar</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {surfaces.map((x) => (
          <li key={x.title} className="rounded-2xl border border-rule bg-surface p-4">
            <span className={`inline-flex size-10 items-center justify-center rounded-xl ${x.tile}`}>
              <x.icon size={20} />
            </span>
            <p className="mt-3 font-semibold">{x.title}</p>
            <p className="text-sm text-faint">{x.where}</p>
            <p className="mt-1.5 text-sm text-muted">{x.what}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl">Keputusan yang penting</h2>
      <ul className="mt-3 overflow-hidden rounded-2xl border border-rule bg-surface">
        {decisions.map(([title, body]) => (
          <li key={title} className="border-b border-rule last:border-b-0">
            <details className="row">
              <summary className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
                <span className="font-medium">{title}</span>
                <ChevronDownIcon className="row-mark shrink-0 text-faint" />
              </summary>
              <p className="px-4 pb-4 text-[0.9375rem] text-muted">{body}</p>
            </details>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl">Dibangun dengan</h2>
      <ul className="mt-3 grid gap-2.5 text-[0.9375rem]">
        {stack.map((line) => (
          <li key={line} className="flex gap-3">
            <CheckIcon size={18} className="mt-0.5 shrink-0 text-mint-ink" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl">Rupa</h2>
      <p className="mt-2 text-[1.0625rem] leading-relaxed text-muted">
        Barbershop lama di siang hari: ubin putih, tiang merah-putih-biru, kursi mint, dan tiket nomor antrean
        yang merah. Satu huruf, Archivo, lebar untuk papan nama dan sempit untuk nomor. Tiap layar punya satu
        tugas.
      </p>

      <div className="mt-10 grid gap-3">
        <ButtonLink href="/demo" block>
          Coba demo
        </ButtonLink>
        <ButtonLink href={brand.builtBy.repo} variant="quiet" block>
          Lihat kode
        </ButtonLink>
      </div>
    </Screen>
  );
}
