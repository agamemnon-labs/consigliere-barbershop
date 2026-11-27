import { describe, expect, it } from "vitest";
import { factsText, intentOf, normalize, ruleReply, type ShopFacts, waLabel } from "./chat";

const facts: ShopFacts = {
  brand: "Consigliere",
  city: "Samarinda",
  now: "Jumat, 27 Nov, 14.05",
  siteUrl: "https://consigliere.test",
  complaintsWa: "6281200000000",
  levels: [
    { name: "Regular", price: 80_000 },
    { name: "Executive", price: 125_000 },
  ],
  services: [
    {
      name: "Haircut",
      slug: "haircut",
      category: "haircut",
      price: "80K–125K",
      fromPrice: 80_000,
      description: null,
      durationMin: 40,
      variants: [],
      bookableOnline: true,
    },
    {
      name: "Coloring fashion",
      slug: "coloring-fashion",
      category: "chemical",
      price: "300K+",
      fromPrice: 300_000,
      description: null,
      durationMin: 120,
      variants: [],
      bookableOnline: false,
    },
    {
      name: "Curly perm",
      slug: "curly-perm",
      category: "chemical",
      price: "400K+",
      fromPrice: 400_000,
      description: null,
      durationMin: 150,
      variants: [
        { name: "Pendek", price: 400_000 },
        { name: "Panjang", price: 600_000 },
      ],
      bookableOnline: false,
    },
  ],
  branches: [
    {
      name: "Jl. Belatuk",
      slug: "belatuk",
      address: "Jl. Belatuk No. 1",
      mapsUrl: null,
      hoursToday: "10.00–21.00",
      closedReason: null,
      barbers: [
        { name: "Vito", level: "Executive", price: 125_000, waiting: 3, waitMin: 90 },
        { name: "Sonny", level: "Regular", price: 80_000, waiting: 0, waitMin: 0 },
      ],
    },
    {
      name: "Citra Niaga",
      slug: "citra-niaga",
      address: "Citra Niaga Blok A",
      mapsUrl: null,
      hoursToday: null,
      closedReason: "renovasi",
      barbers: [],
    },
  ],
  barbers: [
    {
      name: "Vito",
      level: "Executive",
      price: 125_000,
      bio: null,
      week: [
        { day: "Jumat", where: "Jl. Belatuk" },
        { day: "Sabtu", where: "libur" },
        { day: "Minggu", where: "Citra Niaga" },
      ],
    },
  ],
  membership: {
    fee: 30_000,
    pointsPer: 50_000,
    redeemPoints: 10,
    redeemValue: 50_000,
    birthdayPercent: 50,
    birthdayCategories: ["haircut"],
    topups: [{ pay: 500_000, get: 550_000 }],
  },
};

describe("normalize", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalize("  Harga   CUKUR?! ")).toBe("harga cukur");
  });
});

describe("intentOf", () => {
  const cases: [string, ReturnType<typeof intentOf>][] = [
    ["halo kak", "greet"],
    ["berapa harga cukur?", "price"],
    ["antrean belatuk rame gak", "queue"],
    ["vito kerja di mana hari ini", "barber"],
    ["cara jadi member gimana", "member"],
    ["mau booking dong", "book"],
    ["jam berapa buka", "hours"],
    ["alamat cabangnya di mana", "branches"],
    ["mau komplain soal potongan", "complaint"],
    ["makasih ya", "thanks"],
    ["asdfgh", "unknown"],
    ["", "unknown"],
  ];
  for (const [text, intent] of cases) {
    it(`"${text}" is ${intent}`, () => expect(intentOf(text, facts)).toBe(intent));
  }
  it("does not mistake a word that only starts like a greeting", () => {
    expect(intentOf("pomade ada?", facts)).toBe("unknown");
  });
});

describe("ruleReply", () => {
  it("prices a named service by its everyday word", () => {
    const reply = ruleReply("semir rambut berapa?", facts);
    expect(reply).toContain("Coloring fashion: mulai 300K");
    expect(reply).toContain("https://consigliere.test/harga");
  });
  it("prices the haircut by level", () => {
    expect(ruleReply("harga potong", facts)).toContain("Regular 80K, Executive 125K");
  });
  it("gives each category's lowest price when no service is named", () => {
    const reply = ruleReply("pricelist dong", facts);
    expect(reply).toContain("Haircut: Regular 80K");
    expect(reply).toContain("Chemical (warna, perm) mulai 300K");
  });
  it("lists variant prices", () => {
    expect(ruleReply("keriting berapa", facts)).toContain("pendek 400K, panjang 600K");
  });
  it("gives every branch's live line, closures included", () => {
    const reply = ruleReply("antre sekarang gimana", facts);
    expect(reply).toContain("Jl. Belatuk: 3 orang antre, ada barber yang bisa langsung");
    expect(reply).toContain("Citra Niaga: tutup hari ini (renovasi)");
  });
  it("breaks one named branch down by barber", () => {
    const reply = ruleReply("antrian belatuk", facts);
    expect(reply).toContain("Vito (Executive): 3 antre, ± 1 jam 30 menit");
    expect(reply).toContain("Sonny (Regular): 0 antre, langsung duduk");
  });
  it("says where a barber is today and their days off", () => {
    const reply = ruleReply("Vito hari ini di mana?", facts);
    expect(reply).toContain("hari ini di Jl. Belatuk");
    expect(reply).toContain("Libur minggu ini: Sabtu");
  });
  it("explains membership from the shop's rules", () => {
    const reply = ruleReply("member dapat apa aja", facts);
    expect(reply).toContain("Daftar member 30K");
    expect(reply).toContain("10 poin jadi potongan 50K");
    expect(reply).toContain("diskon 50% untuk haircut");
    expect(reply).toContain("500K jadi 550K");
  });
  it("sends complaints to the shop's WhatsApp", () => {
    expect(ruleReply("aku kecewa", facts)).toContain("0812-0000-0000");
  });
  it("never leaves an unknown question without a way forward", () => {
    expect(ruleReply("qwerty", facts)).toContain("Coba tanya");
  });
});

describe("waLabel", () => {
  it("formats an Indonesian number for people", () => {
    expect(waLabel("6281200000000")).toBe("0812-0000-0000");
  });
});

describe("factsText", () => {
  it("carries prices, queues, schedules and rules", () => {
    const text = factsText(facts);
    expect(text).toContain("Regular: 80K");
    expect(text).toContain("TUTUP hari ini: renovasi");
    expect(text).toContain("Vito (Executive, 125K): 3 antre");
    expect(text).toContain("Sabtu libur");
    expect(text).toContain("tidak bisa dipesan online");
  });
});
