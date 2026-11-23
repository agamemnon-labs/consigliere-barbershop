import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { CardIcon, ChartIcon, ClockIcon, MapPinIcon, ScissorsIcon, TicketIcon } from "@/components/icons";
import { Notice } from "@/components/notice";
import { Pole } from "@/components/pole";
import { PriceList } from "@/components/price-list";
import { Screen } from "@/components/screen";
import { Steps } from "@/components/steps";
import { Ticket } from "@/components/ticket";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Lembar gaya", robots: { index: false } };

/** Every colour token with what it is for. Values live in globals.css; this page only names them. */
const swatches: { name: string; cls: string; use: string; ink?: string }[] = [
  { name: "bg", cls: "bg-bg", use: "Halaman, ubin putih dingin" },
  { name: "surface", cls: "bg-surface", use: "Kartu dan daftar" },
  { name: "sunk", cls: "bg-sunk", use: "Isian tenggelam, kerangka muat" },
  { name: "fg", cls: "bg-fg", use: "Tinta navy", ink: "text-white" },
  { name: "accent", cls: "bg-accent", use: "Merah tiang: tiket, bayar, panggil", ink: "text-accent-fg" },
  { name: "blue", cls: "bg-blue", use: "Pilihan, fokus, tautan", ink: "text-white" },
  { name: "mint", cls: "bg-mint", use: "Kursi kosong, lunas, selesai", ink: "text-mint-ink" },
  { name: "butter", cls: "bg-butter", use: "Dipanggil, perhatian", ink: "text-butter-ink" },
  { name: "navy", cls: "pinstripe", use: "Kartu member, tombol gelap", ink: "text-navy-fg" },
];

export default function StyleSheet() {
  return (
    <Screen back={{ href: "/", label: "Beranda" }}>
      <p className="label">Lembar gaya</p>
      <h1 className="mt-1 text-[2rem] leading-tight">Barbershop lama, di siang hari</h1>
      <p className="mt-3 text-muted">
        Ubin putih, tiang merah-putih-biru, kursi mint, krom, dan tiket ambil nomor. Halaman tetap tenang;
        warna muncul di beberapa momen saja. Merah hanya untuk aksi: tiket, bayar, panggil.
      </p>

      <Part title="Warna">
        <ul className="grid grid-cols-3 gap-2.5">
          {swatches.map((s) => (
            <li key={s.name}>
              <div
                className={`flex h-18 items-end rounded-xl border border-rule p-2 text-sm font-semibold ${s.cls} ${s.ink ?? "text-fg"}`}
              >
                {s.name}
              </div>
              <p className="mt-1.5 text-xs text-muted">{s.use}</p>
            </li>
          ))}
        </ul>
      </Part>

      <Part title="Huruf">
        <div className="grid gap-4 rounded-2xl border border-rule bg-surface p-4">
          <div>
            <p className="label">Archivo lebar, untuk papan nama</p>
            <Wordmark size="lg" className="mt-2" />
          </div>
          <div>
            <p className="label">Judul, 600, sedikit lebar</p>
            <p className="mt-1 text-[2rem] leading-tight font-semibold [font-stretch:110%]">
              Mau cukur di mana?
            </p>
          </div>
          <div>
            <p className="label">Teks, 400</p>
            <p className="mt-1">Ambil nomor dari HP, bayar QRIS, datang pas giliranmu.</p>
          </div>
          <div>
            <p className="label">Sempit, untuk nomor antrean</p>
            <p className="condensed num mt-1 text-7xl leading-none font-semibold text-accent">J 021</p>
          </div>
          <div>
            <p className="label">Angka tabular, untuk uang dan jam</p>
            <p className="num mt-1 flex gap-6 text-2xl font-semibold">
              <span>Rp 80.000</span>
              <span>14.40</span>
            </p>
          </div>
        </div>
      </Part>

      <Part title="Tiang dan tiket">
        <div className="flex items-center gap-6 rounded-2xl border border-rule bg-surface p-4">
          <span className="flex items-center gap-2 text-sm">
            <Pole turning /> Langsung
          </span>
          <span className="flex items-center gap-2 text-sm">
            <Pole /> Diam
          </span>
          <span className="flex items-center gap-2 text-sm">
            <Pole off /> Tutup
          </span>
        </div>
        <Ticket
          className="mt-4"
          number={21}
          prefix="J"
          barber="Rizal"
          branch="Juanda"
          waitMin={35}
          around="14.40"
        />
      </Part>

      <Part title="Tombol">
        <div className="grid gap-2.5">
          <Button block>Bayar Rp 80.000 pakai QRIS</Button>
          <Button variant="dark" block>
            Lanjut
          </Button>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="quiet">Batal</Button>
            <Button variant="soft">Isi saldo</Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-faint">
          Merah untuk uang dan antrean, navy untuk lanjut, satu utama per layar
        </p>
      </Part>

      <Part title="Isian dan langkah">
        <Steps at={2} of={4} />
        <div className="mt-4 grid gap-4">
          <Field label="Nama panggilan" name="contoh-nama" defaultValue="Bima" />
          <Field label="Nomor WhatsApp" name="contoh-hp" type="tel" error="Nomor ini belum lengkap" />
        </div>
      </Part>

      <Part title="Pemberitahuan">
        <div className="grid gap-2.5">
          <Notice tone="info" title="Mode demo">
            Tanpa uang sungguhan
          </Notice>
          <Notice tone="ok" title="Lunas">
            Nomormu sudah masuk antrean
          </Notice>
          <Notice tone="warn" title="Dipanggil">
            Silakan ke kursi Rizal
          </Notice>
          <Notice tone="alert" title="Belum bisa lanjut">
            Antrean Rizal sudah penuh hari ini
          </Notice>
        </div>
      </Part>

      <Part title="Barber dan ikon">
        <div className="flex items-center gap-3">
          <Avatar name="Rizal" size="lg" />
          <Avatar name="Dimas" size="lg" />
          <Avatar name="Fikri" size="lg" />
          <Avatar name="Agus" size="lg" />
        </div>
        <div className="mt-4 flex gap-4 text-muted">
          <TicketIcon />
          <CardIcon />
          <ScissorsIcon />
          <ClockIcon />
          <MapPinIcon />
          <ChartIcon />
        </div>
        <p className="mt-2 text-sm text-faint">
          Ikon hanya untuk navigasi dan beberapa fakta, tidak untuk hiasan
        </p>
      </Part>

      <Part title="Daftar harga">
        <PriceList />
      </Part>
    </Screen>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl">{title}</h2>
      {children}
    </section>
  );
}
