/**
 * Demo data. Prices come from a real Samarinda pricelist; branches, people and
 * addresses are fictional. Pure data: safe to import from pages and tests.
 */

export const branchSeed = [
  {
    slug: "juanda",
    name: "Juanda",
    address: "Jl. Juanda, Samarinda Ulu",
    openHours: everyDay("10:00", "22:00"),
  },
  {
    slug: "pramuka",
    name: "Pramuka",
    address: "Jl. Pramuka, Samarinda Ulu",
    openHours: everyDay("10:00", "22:00"),
  },
  {
    slug: "tepian",
    name: "Tepian",
    address: "Jl. Slamet Riyadi, Samarinda Seberang",
    openHours: everyDay("11:00", "23:00"),
  },
] as const;

export const levelSeed = [
  { slug: "regular", name: "Regular", haircutPrice: 80_000, sort: 1 },
  { slug: "senior", name: "Senior", haircutPrice: 95_000, sort: 2 },
  { slug: "premium", name: "Premium", haircutPrice: 110_000, sort: 3 },
  { slug: "executive", name: "Executive", haircutPrice: 125_000, sort: 4 },
] as const;

type LevelSlug = (typeof levelSeed)[number]["slug"];
type BranchSlug = (typeof branchSeed)[number]["slug"];

/** `home` is where the barber usually works; `offDay` is 0 = Sunday … 6 = Saturday. */
export const barberSeed: {
  slug: string;
  name: string;
  level: LevelSlug;
  home: BranchSlug;
  offDay: number;
  bio: string;
}[] = [
  { slug: "vito", name: "Vito", level: "executive", home: "juanda", offDay: 1, bio: "Gunting klasik, rapi sampai ke tengkuk." },
  { slug: "sonny", name: "Sonny", level: "premium", home: "juanda", offDay: 2, bio: "Taper dan skin fade yang bersih." },
  { slug: "paulie", name: "Paulie", level: "senior", home: "juanda", offDay: 3, bio: "Pompadour, slick back, dan obrolan panjang." },
  { slug: "tommy", name: "Tommy", level: "regular", home: "juanda", offDay: 4, bio: "Cepat, teliti, tidak banyak tanya." },
  { slug: "michael", name: "Michael", level: "premium", home: "pramuka", offDay: 1, bio: "Textured crop dan warna." },
  { slug: "henry", name: "Henry", level: "senior", home: "pramuka", offDay: 2, bio: "Perm dan potongan panjang." },
  { slug: "fredo", name: "Fredo", level: "regular", home: "pramuka", offDay: 3, bio: "Buzz cut sampai crew cut." },
  { slug: "luca", name: "Luca", level: "regular", home: "pramuka", offDay: 5, bio: "Shaving klasik dengan handuk panas." },
  { slug: "jimmy", name: "Jimmy", level: "senior", home: "tepian", offDay: 1, bio: "Side part yang tahan seharian." },
  { slug: "tony", name: "Tony", level: "regular", home: "tepian", offDay: 2, bio: "Fade rendah, garis tegas." },
  { slug: "sal", name: "Sal", level: "regular", home: "tepian", offDay: 4, bio: "Rapi untuk kantor, rapi untuk kondangan." },
  { slug: "carlo", name: "Carlo", level: "executive", home: "tepian", offDay: 0, bio: "Konsultasi gaya, potongan, dan perawatan." },
];

type ServiceSeed = {
  slug: string;
  name: string;
  description: string;
  durationMin: number;
} & (
  | { category: "haircut"; priceType: "by_level" }
  | { category: "chemical" | "refreshment"; priceType: "fixed"; price: number }
  | { category: "chemical"; priceType: "from"; priceFrom: number }
  | {
      category: "chemical";
      priceType: "variant";
      variants: { name: string; price: number; durationMin: number }[];
    }
  | { category: "package"; priceType: "fixed"; price: number; items: string[] }
);

export const serviceSeed: ServiceSeed[] = [
  {
    slug: "haircut",
    category: "haircut",
    priceType: "by_level",
    name: "Haircut",
    description: "Konsultasi, potong, cuci, dan styling. Harga mengikuti level barber.",
    durationMin: 30,
  },
  {
    slug: "toning",
    category: "chemical",
    priceType: "fixed",
    price: 150_000,
    name: "Toning",
    description: "Menetralkan warna kuning atau oranye setelah bleaching.",
    durationMin: 60,
  },
  {
    slug: "coloring-fashion",
    category: "chemical",
    priceType: "from",
    priceFrom: 300_000,
    name: "Coloring Fashion",
    description: "Warna penuh atau highlight. Harga akhir tergantung panjang rambut dan warna.",
    durationMin: 120,
  },
  {
    slug: "curly-perm",
    category: "chemical",
    priceType: "variant",
    name: "Curly Perm",
    description: "Ikal permanen yang tetap terlihat alami.",
    durationMin: 90,
    variants: [
      { name: "Pendek", price: 400_000, durationMin: 90 },
      { name: "Panjang", price: 600_000, durationMin: 120 },
    ],
  },
  {
    slug: "cold-wave",
    category: "chemical",
    priceType: "variant",
    name: "Cold Wave",
    description: "Gelombang lembut dengan teknik dingin.",
    durationMin: 120,
    variants: [
      { name: "Pendek", price: 500_000, durationMin: 120 },
      { name: "Panjang", price: 700_000, durationMin: 150 },
    ],
  },
  {
    slug: "rootlift",
    category: "chemical",
    priceType: "fixed",
    price: 90_000,
    name: "Rootlift",
    description: "Mengangkat akar rambut supaya bervolume.",
    durationMin: 45,
  },
  {
    slug: "down-perm",
    category: "chemical",
    priceType: "fixed",
    price: 175_000,
    name: "Down Perm",
    description: "Menidurkan rambut samping yang mengembang.",
    durationMin: 60,
  },
  {
    slug: "classic-shaving",
    category: "refreshment",
    priceType: "fixed",
    price: 70_000,
    name: "Classic Shaving",
    description: "Cukur dengan pisau, handuk panas, dan aftershave.",
    durationMin: 20,
  },
  {
    slug: "wash-styling",
    category: "refreshment",
    priceType: "fixed",
    price: 35_000,
    name: "Wash & Styling",
    description: "Keramas dan ditata ulang.",
    durationMin: 15,
  },
  {
    slug: "hair-refreshment",
    category: "refreshment",
    priceType: "fixed",
    price: 50_000,
    name: "Hair Refreshment",
    description: "Pijat kepala dan perawatan kulit kepala.",
    durationMin: 15,
  },
  {
    slug: "face-refreshment",
    category: "refreshment",
    priceType: "fixed",
    price: 50_000,
    name: "Face Refreshment",
    description: "Membersihkan dan menyegarkan wajah.",
    durationMin: 15,
  },
  {
    slug: "peel-mask-face",
    category: "refreshment",
    priceType: "fixed",
    price: 50_000,
    name: "Peel of Mask, Wajah",
    description: "Masker peel-off satu wajah penuh.",
    durationMin: 15,
  },
  {
    slug: "peel-mask-nose",
    category: "refreshment",
    priceType: "fixed",
    price: 25_000,
    name: "Peel of Mask, Hidung",
    description: "Mengangkat komedo di hidung.",
    durationMin: 10,
  },
  {
    slug: "ear-candle",
    category: "refreshment",
    priceType: "fixed",
    price: 30_000,
    name: "Ear Candle",
    description: "Terapi lilin telinga yang menenangkan.",
    durationMin: 15,
  },
  {
    slug: "rootlift-down-perm",
    category: "package",
    priceType: "fixed",
    price: 250_000,
    name: "Rootlift + Down Perm",
    description: "Atas bervolume, samping rapi. Lebih hemat dari dua layanan terpisah.",
    durationMin: 90,
    items: ["rootlift", "down-perm"],
  },
];

export const topupSeed = [
  { pay: 300_000, get: 330_000 },
  { pay: 500_000, get: 575_000 },
] as const;

export const settingsSeed: Record<string, unknown> = {
  membership_fee: 30_000,
  birthday_discount: { percent: 50, categories: ["haircut"], stacksWithPoints: false },
  points: { earnPer: 50_000, redeemPoints: 10, redeemValue: 50_000 },
  queue_grace_minutes: 5,
  queue_alert_when_ahead: 2,
  pending_booking_minutes: 15,
  credit_valid_days: 30,
  tv_strip_enabled: false,
  default_commission_bps: 4_000,
};

/** Demo staff. Passwords come from SEED_STAFF_PASSWORD; never use these in production. */
export const staffSeed: {
  email: string;
  name: string;
  role: "cashier" | "admin" | "owner";
  branch?: BranchSlug;
}[] = [
  { email: "owner@consigliere.test", name: "Don", role: "owner" },
  { email: "admin@consigliere.test", name: "Tom", role: "admin" },
  { email: "kasir.juanda@consigliere.test", name: "Connie", role: "cashier", branch: "juanda" },
  { email: "kasir.pramuka@consigliere.test", name: "Kay", role: "cashier", branch: "pramuka" },
  { email: "kasir.tepian@consigliere.test", name: "Lucy", role: "cashier", branch: "tepian" },
];

function everyDay(open: string, close: string) {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  return Object.fromEntries(days.map((d) => [d, [open, close] as [string, string]]));
}
