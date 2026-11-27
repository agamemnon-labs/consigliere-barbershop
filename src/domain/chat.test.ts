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

describe("ruleReply, specific questions", () => {
  const busy: ShopFacts = {
    ...facts,
    branches: [
      ...facts.branches,
      {
        name: "Pulau Kalimantan",
        slug: "pulau-kalimantan",
        address: "Jl. Pulau Kalimantan No. 9",
        mapsUrl: "https://maps.test/kalimantan",
        hoursToday: "10.00–22.00",
        closedReason: null,
        barbers: [
          { name: "Luca", level: "Senior", price: 95_000, waiting: 5, waitMin: 120 },
          { name: "Paulie", level: "Regular", price: 80_000, waiting: 4, waitMin: 75 },
        ],
      },
    ],
  };

  it("names only the quietest branch, with a reason, address and link", () => {
    const reply = ruleReply("dimana cabang yang paling sepi?", busy);
    expect(reply).toContain("Paling sepi sekarang: Jl. Belatuk");
    expect(reply).toContain("Sonny (Regular) bisa langsung duduk");
    expect(reply).toContain("Alamat: Jl. Belatuk No. 1");
    expect(reply).toContain("/antre?cabang=belatuk");
    expect(reply).not.toContain("Pulau Kalimantan");
    expect(reply).not.toContain("Citra Niaga");
  });
  it("treats 'kosong' and 'paling cepat' the same way", () => {
    expect(ruleReply("barber yang kosong di mana", busy)).toContain("Paling sepi sekarang: Jl. Belatuk");
    expect(ruleReply("mana yang paling cepat", busy)).toContain("Paling sepi sekarang: Jl. Belatuk");
  });
  it("names the busiest branch and points to a quicker one", () => {
    const reply = ruleReply("cabang mana yang paling rame", busy);
    expect(reply).toContain("Paling rame sekarang: Pulau Kalimantan, 9 orang antre");
    expect(reply).toContain("Jl. Belatuk paling sepi");
  });
  it("says so when no branch is open", () => {
    const shut = { ...facts, branches: facts.branches.filter((b) => b.closedReason) };
    expect(ruleReply("cabang paling sepi", shut)).toContain("belum ada cabang yang buka");
  });
  it("gives one barber's live line", () => {
    const reply = ruleReply("antrean vito berapa", busy);
    expect(reply).toContain("Vito hari ini di Jl. Belatuk: 3 antre, ± 1 jam 30 menit");
    expect(reply).not.toContain("Sonny");
  });
  it("answers a barber's schedule for tomorrow or a named day", () => {
    expect(ruleReply("vito besok kerja di mana", facts)).toContain(
      "Vito (Executive, haircut 125K): libur besok",
    );
    expect(ruleReply("hari minggu vito di mana", facts)).toContain("hari Minggu di Citra Niaga");
  });
  it("does not read 'minggu ini' as Sunday", () => {
    expect(ruleReply("vito libur minggu ini kapan", facts)).toContain("hari ini di Jl. Belatuk");
  });
  it("adds a barber's live line when they are on today", () => {
    expect(ruleReply("vito hari ini di mana", facts)).toContain("Antrean sekarang 3 orang");
  });
  it("gives one branch's address or hours when one is named", () => {
    const address = ruleReply("alamat cabang kalimantan di mana", busy);
    expect(address).toContain("Pulau Kalimantan, buka 10.00–22.00 hari ini");
    expect(address).toContain("https://maps.test/kalimantan");
    expect(address).not.toContain("Belatuk");
    const hours = ruleReply("belatuk buka jam berapa", busy);
    expect(hours).toContain("Jl. Belatuk: 10.00–21.00");
    expect(hours).not.toContain("Kalimantan");
  });
  it("prices one barber level", () => {
    const reply = ruleReply("harga potong executive berapa", facts);
    expect(reply).toContain("Haircut sama barber Executive: 125K");
    expect(reply).not.toContain("Regular");
  });
  it("names the cheapest haircut", () => {
    expect(ruleReply("yang paling murah berapa", facts)).toContain(
      "Paling murah: Haircut sama barber Regular, 80K",
    );
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
