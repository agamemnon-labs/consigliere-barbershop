/**
 * The chatbot's shop knowledge and its rule-based answers. Pure functions: the
 * server builds a `ShopFacts` snapshot from the database, and every channel (web
 * chat, Telegram, later WhatsApp) asks the same brain. The AI brain reads the
 * same snapshot through `factsText`, so both answer from one set of facts.
 */
import { formatShort } from "./money";

export type FactService = {
  name: string;
  slug: string;
  category: "haircut" | "chemical" | "refreshment" | "package";
  /** "80K–125K", "300K+", "150K" */
  price: string;
  /** The lowest price a customer can pay for it, in rupiah. */
  fromPrice: number;
  description: string | null;
  durationMin: number;
  variants: { name: string; price: number }[];
  bookableOnline: boolean;
};

export type FactBarberToday = {
  name: string;
  level: string;
  price: number;
  waiting: number;
  waitMin: number;
};

export type FactBranch = {
  name: string;
  slug: string;
  address: string;
  mapsUrl: string | null;
  /** "10.00–21.00", or null when closed every day */
  hoursToday: string | null;
  closedReason: string | null;
  /** On duty today with their live line. Empty when closed or nobody is on. */
  barbers: FactBarberToday[];
};

export type FactBarber = {
  name: string;
  level: string;
  price: number;
  bio: string | null;
  /** The next 7 days from today: branch name, "libur", or null when not planned yet. */
  week: { day: string; where: string | null }[];
};

export type ShopFacts = {
  brand: string;
  city: string;
  /** "Jum, 27 Nov, 14.05" */
  now: string;
  siteUrl: string;
  complaintsWa: string;
  levels: { name: string; price: number }[];
  services: FactService[];
  branches: FactBranch[];
  barbers: FactBarber[];
  membership: {
    fee: number;
    pointsPer: number;
    redeemPoints: number;
    redeemValue: number;
    birthdayPercent: number;
    birthdayCategories: string[];
    topups: { pay: number; get: number }[];
  };
};

export type Intent =
  | "greet"
  | "queue"
  | "price"
  | "branches"
  | "hours"
  | "barber"
  | "member"
  | "book"
  | "complaint"
  | "thanks"
  | "unknown";

/** Lowercase, no punctuation, single spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole words, allowing the everyday suffixes (-nya, -kah, -lah): "harganya", "bukakah". */
const has = (t: string, words: string[]) =>
  words.some((w) => new RegExp(`(^| )${w}(nya|kah|lah)?( |$)`).test(t));

/** Everyday words for a service, so "semir" finds coloring and "cukur" finds the haircut. */
const SERVICE_WORDS: Record<string, string[]> = {
  haircut: ["haircut", "cukur", "potong", "pangkas", "gunting", "rambut biasa"],
  toning: ["toning"],
  "coloring-fashion": ["coloring", "warna", "semir", "cat rambut", "highlight", "bleach"],
  "curly-perm": ["curly", "keriting", "perm"],
  "cold-wave": ["cold wave", "coldwave", "gelombang"],
  rootlift: ["rootlift", "root lift"],
  "down-perm": ["down perm", "downperm"],
  "classic-shaving": ["shaving", "cukur jenggot", "jenggot", "kumis"],
  "ear-candle": ["ear candle", "kuping", "telinga"],
  "wash-styling": ["wash", "styling", "keramas"],
  "face-refreshment": ["face refreshment", "wajah"],
  "hair-refreshment": ["hair refreshment", "creambath", "hair spa"],
};

/** Services the message names, by everyday word or by their own name. */
export function servicesIn(text: string, services: FactService[]): FactService[] {
  const t = normalize(text);
  return services.filter((s) => {
    const words = [...(SERVICE_WORDS[s.slug] ?? []), normalize(s.name)];
    return words.some((w) => t.includes(w));
  });
}

export function branchesIn(text: string, branches: FactBranch[]): FactBranch[] {
  const t = normalize(text);
  return branches.filter((b) => {
    const key = normalize(b.name).replace(/^jl /, "");
    const words = [key, ...key.split(" ").filter((w) => w.length >= 5 && w !== "pulau")];
    return words.some((w) => t.includes(w));
  });
}

export function barbersIn(text: string, barbers: FactBarber[]): FactBarber[] {
  const t = ` ${normalize(text)} `;
  return barbers.filter((b) => t.includes(` ${normalize(b.name)} `));
}

/** What the customer is asking about. The first match wins, most specific first. */
export function intentOf(text: string, facts: Pick<ShopFacts, "barbers">): Intent {
  const t = normalize(text);
  if (!t) return "unknown";
  if (has(t, ["komplain", "keluhan", "kecewa", "protes", "lapor"])) return "complaint";
  if (has(t, ["member", "poin", "point", "saldo", "top up", "topup", "ulang tahun", "ultah", "kartu"]))
    return "member";
  if (has(t, ["antre", "antri", "antrian", "antrean", "rame", "ramai", "sepi", "nunggu", "tunggu", "penuh"]))
    return "queue";
  if (has(t, ["booking", "book", "pesan", "reservasi", "ambil nomor", "daftar antre", "cara antre"]))
    return "book";
  if (barbersIn(t, facts.barbers).length > 0) return "barber";
  if (has(t, ["buka", "tutup", "jam", "libur"])) return "hours";
  if (
    has(t, ["harga", "berapa", "biaya", "tarif", "price", "pricelist", "mahal", "murah", "layanan", "menu"])
  )
    return "price";
  if (has(t, ["cabang", "alamat", "lokasi", "dimana", "di mana", "maps", "arah"])) return "branches";
  if (has(t, ["makasih", "terima kasih", "thanks", "thank", "mantap", "oke", "ok", "sip"])) return "thanks";
  if (
    has(t, ["halo", "hai", "hi", "hello", "pagi", "siang", "sore", "malam", "assalamualaikum", "start", "p"])
  )
    return "greet";
  return "unknown";
}

const SUGGEST = "Coba tanya: harga haircut, antrean sekarang, Vito kerja di mana, atau cara jadi member.";

function waitLabel(min: number): string {
  if (min <= 0) return "langsung duduk";
  if (min < 60) return `± ${min} menit`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `± ${h} jam ${m} menit` : `± ${h} jam`;
}

function servicePrice(s: FactService, levels: ShopFacts["levels"]): string {
  if (s.category === "haircut") {
    return `${s.name}: ${levels.map((l) => `${l.name} ${formatShort(l.price)}`).join(", ")}. Harganya ikut level barber.`;
  }
  if (s.variants.length > 0) {
    return `${s.name}: ${s.variants.map((v) => `${v.name.toLowerCase()} ${formatShort(v.price)}`).join(", ")}`;
  }
  const from = s.price.endsWith("+") ? `mulai ${s.price.slice(0, -1)}` : s.price;
  return `${s.name}: ${from}`;
}

function branchQueue(b: FactBranch): string {
  if (b.closedReason) return `${b.name}: tutup hari ini (${b.closedReason})`;
  if (b.barbers.length === 0) return `${b.name}: belum ada barber yang jaga`;
  const best = Math.min(...b.barbers.map((x) => x.waitMin));
  const waiting = b.barbers.reduce((n, x) => n + x.waiting, 0);
  const fastest = best <= 0 ? "ada barber yang bisa langsung" : `paling cepat ${waitLabel(best)}`;
  return `${b.name}: ${waiting} orang antre, ${fastest}`;
}

const CATEGORY_NAMES: Record<FactService["category"], string> = {
  haircut: "Haircut",
  chemical: "Chemical (warna, perm)",
  refreshment: "Perawatan",
  package: "Paket",
};

/** "Perawatan mulai 25K" for each category other than the haircut. */
function categoryFloors(services: FactService[]): string[] {
  const order: FactService["category"][] = ["refreshment", "chemical", "package"];
  return order.flatMap((c) => {
    const prices = services.filter((s) => s.category === c).map((s) => s.fromPrice);
    return prices.length ? [`${CATEGORY_NAMES[c]} mulai ${formatShort(Math.min(...prices))}`] : [];
  });
}

/** A plain-text answer for one message, from the facts alone. Works with no AI at all. */
export function ruleReply(text: string, facts: ShopFacts): string {
  const intent = intentOf(text, facts);
  const site = facts.siteUrl;
  switch (intent) {
    case "greet":
      return `Halo, ini asisten ${facts.brand} ${facts.city}. Aku bisa bantu soal harga, antrean, cabang, barber, dan member.\n\n${SUGGEST}`;
    case "thanks":
      return "Sama-sama. Kalau ada yang mau ditanya lagi, tinggal ketik aja.";
    case "complaint":
      return `Maaf banget kalau ada yang kurang. Ceritain langsung ke tim kami lewat WhatsApp ${waLabel(facts.complaintsWa)}, nanti dibantu.`;
    case "price": {
      const found = servicesIn(text, facts.services);
      if (found.length > 0) {
        const lines = found.map((s) => servicePrice(s, facts.levels));
        return `${lines.join("\n")}\n\nDaftar lengkapnya: ${site}/harga`;
      }
      const haircut = facts.services.find((s) => s.category === "haircut");
      const lines = [haircut ? servicePrice(haircut, facts.levels) : null, ...categoryFloors(facts.services)];
      return `${lines.filter(Boolean).join("\n")}\n\nSemua harga: ${site}/harga`;
    }
    case "queue": {
      const named = branchesIn(text, facts.branches);
      if (named.length === 1) {
        const b = named[0] as FactBranch;
        if (b.closedReason || b.barbers.length === 0) return branchQueue(b);
        const rows = b.barbers.map(
          (x) => `${x.name} (${x.level}): ${x.waiting} antre, ${waitLabel(x.waitMin)}`,
        );
        return `Antrean ${b.name} sekarang:\n${rows.join("\n")}\n\nAmbil nomor dari HP: ${site}/antre`;
      }
      const rows = facts.branches.map(branchQueue);
      return `Antrean sekarang:\n${rows.join("\n")}\n\nAmbil nomor dari HP, bayar QRIS, datang pas giliranmu: ${site}/antre`;
    }
    case "book":
      return `Ambil nomor lewat ${site}/antre: pilih cabang, pilih barber atau yang paling cepat, pilih layanan, isi nama dan nomor WhatsApp, lalu bayar QRIS. Nomormu langsung masuk antrean.\n\nAku belum bisa ambil nomor dari chat ini.`;
    case "barber": {
      const lines = barbersIn(text, facts.barbers).map((b) => {
        const today = b.week[0]?.where;
        const where =
          today === "libur"
            ? "libur hari ini"
            : today
              ? `hari ini di ${today}`
              : "jadwal hari ini belum diatur";
        const off = b.week.filter((d) => d.where === "libur").map((d) => d.day);
        const offText = off.length ? ` Libur minggu ini: ${off.join(", ")}.` : "";
        return `${b.name} (${b.level}, haircut ${formatShort(b.price)}): ${where}.${offText}`;
      });
      return `${lines.join("\n")}\n\nJadwal semua barber: ${site}/barber`;
    }
    case "hours": {
      const rows = facts.branches.map((b) =>
        b.closedReason
          ? `${b.name}: tutup hari ini (${b.closedReason})`
          : `${b.name}: ${b.hoursToday ?? "tutup"}`,
      );
      return `Jam buka hari ini:\n${rows.join("\n")}`;
    }
    case "branches": {
      const rows = facts.branches.map((b) => `${b.name}: ${b.address}${b.mapsUrl ? ` (${b.mapsUrl})` : ""}`);
      return `Cabang ${facts.brand} di ${facts.city}:\n${rows.join("\n")}`;
    }
    case "member": {
      const m = facts.membership;
      const topups = m.topups.map((t) => `${formatShort(t.pay)} jadi ${formatShort(t.get)}`).join(", ");
      const lines = [
        `Daftar member ${formatShort(m.fee)} di kasir, cukup nama, tanggal lahir, nomor HP, dan PIN 6 angka.`,
        `Tiap ${formatShort(m.pointsPer)} dapat 1 poin, ${m.redeemPoints} poin jadi potongan ${formatShort(m.redeemValue)}.`,
        `Bulan ulang tahun diskon ${m.birthdayPercent}% untuk ${m.birthdayCategories.join(", ")}.`,
        topups ? `Top up saldo: ${topups}.` : null,
      ].filter(Boolean);
      return `${lines.join("\n")}\n\nKartu member: ${site}/kartu`;
    }
    case "unknown":
      return `Maaf, aku belum nangkep maksudnya. ${SUGGEST}`;
  }
}

/** "6281200000000" → "0812-0000-0000" */
export function waLabel(e164: string): string {
  const local = e164.startsWith("62") ? `0${e164.slice(2)}` : e164;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

/** The facts as compact text, for the AI brain's instructions. */
export function factsText(facts: ShopFacts): string {
  const m = facts.membership;
  const lines: string[] = [];
  lines.push(`Sekarang: ${facts.now} WITA. Situs: ${facts.siteUrl}`);
  lines.push("", "## Harga haircut per level barber");
  for (const l of facts.levels) lines.push(`- ${l.name}: ${formatShort(l.price)}`);
  lines.push("", "## Layanan");
  for (const s of facts.services) {
    const variants = s.variants.length
      ? ` (${s.variants.map((v) => `${v.name} ${formatShort(v.price)}`).join(", ")})`
      : "";
    const online = s.bookableOnline ? "" : ", bayar di kasir, tidak bisa dipesan online";
    lines.push(
      `- ${s.name} [${s.category}]: ${s.price}${variants}, ${s.durationMin} menit${online}. ${s.description ?? ""}`.trim(),
    );
  }
  lines.push("", "## Cabang dan antrean sekarang");
  for (const b of facts.branches) {
    const status = b.closedReason ? `TUTUP hari ini: ${b.closedReason}` : `buka ${b.hoursToday ?? "-"}`;
    lines.push(`- ${b.name}, ${b.address}${b.mapsUrl ? `, ${b.mapsUrl}` : ""}. ${status}`);
    for (const x of b.barbers) {
      lines.push(
        `  - ${x.name} (${x.level}, ${formatShort(x.price)}): ${x.waiting} antre, tunggu ${waitLabel(x.waitMin)}`,
      );
    }
  }
  lines.push("", "## Barber dan jadwal 7 hari");
  for (const b of facts.barbers) {
    const week = b.week.map((d) => `${d.day} ${d.where ?? "belum diatur"}`).join("; ");
    lines.push(`- ${b.name} (${b.level}, ${formatShort(b.price)}). ${b.bio ?? ""} Jadwal: ${week}`);
  }
  lines.push("", "## Member");
  lines.push(
    `- Daftar ${formatShort(m.fee)} di kasir (nama, tanggal lahir, nomor HP, PIN 6 angka). Kartu digital dengan QR.`,
  );
  lines.push(
    `- 1 poin tiap ${formatShort(m.pointsPer)} yang dibayar; ${m.redeemPoints} poin = potongan ${formatShort(m.redeemValue)}.`,
  );
  lines.push(`- Bulan ulang tahun: diskon ${m.birthdayPercent}% untuk ${m.birthdayCategories.join(", ")}.`);
  lines.push(
    `- Top up saldo: ${m.topups.map((t) => `bayar ${formatShort(t.pay)} dapat ${formatShort(t.get)}`).join(", ")}. Saldo tidak hangus.`,
  );
  lines.push("", "## Aturan antre");
  lines.push(
    "- Ambil nomor online lewat situs, bayar QRIS dulu baru masuk antrean. Walk-in daftar di kasir. Antrean per barber.",
  );
  lines.push(
    "- Telat lebih dari 5 menit saat dipanggil: mundur satu nomor. Tidak hadir di panggilan kedua: uangnya jadi kredit 30 hari (member: jadi saldo).",
  );
  lines.push("- Pembayaran nontunai saja (kartu atau QRIS).");
  lines.push(`- Komplain: WhatsApp ${waLabel(facts.complaintsWa)}.`);
  return lines.join("\n");
}
