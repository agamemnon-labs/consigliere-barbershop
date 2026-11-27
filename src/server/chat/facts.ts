import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { brand } from "@/config/brand";
import { type Database, schema as s } from "@/db";
import { bookableOnline } from "@/domain/booking";
import type { FactBarber, FactBranch, FactService, ShopFacts } from "@/domain/chat";
import { priceLabel } from "@/domain/pricing";
import { barberWeek, DAY_NAMES, shortDate } from "@/domain/schedule";
import { addDays, clockLabel, shopClock, shopDate, weekday } from "@/domain/time";
import { rules } from "@/server/backoffice";
import { getBranchQueue } from "@/server/queue";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Everything the bot may say, read fresh from the database: prices, branches with
 * their live lines, the week's rotation and the member rules. Both brains answer
 * from this one snapshot, so the bot never knows more than the shop's own data.
 */
export async function shopFacts(db: Database, now: Date, siteUrl: string): Promise<ShopFacts> {
  const today = shopDate(now);
  const lastDay = addDays(today, 6);
  const [levels, services, variants, branches, barbers, shifts, closures, shopRules] = await Promise.all([
    db.select().from(s.barberLevels).orderBy(asc(s.barberLevels.sort)),
    db.select().from(s.services).where(eq(s.services.isActive, true)).orderBy(asc(s.services.sort)),
    db.select().from(s.serviceVariants).orderBy(asc(s.serviceVariants.sort)),
    db.select().from(s.branches).where(eq(s.branches.isActive, true)).orderBy(asc(s.branches.name)),
    db
      .select({ barber: s.barbers, level: s.barberLevels })
      .from(s.barbers)
      .innerJoin(s.barberLevels, eq(s.barbers.levelId, s.barberLevels.id))
      .where(eq(s.barbers.isActive, true)),
    db
      .select({
        barberId: s.barberShifts.barberId,
        date: s.barberShifts.date,
        status: s.barberShifts.status,
        branchId: s.barberShifts.branchId,
      })
      .from(s.barberShifts)
      .where(and(gte(s.barberShifts.date, today), lte(s.barberShifts.date, lastDay))),
    db
      .select({ branchId: s.closures.branchId, date: s.closures.date, reason: s.closures.reason })
      .from(s.closures)
      .where(and(gte(s.closures.date, today), lte(s.closures.date, lastDay))),
    rules(db),
  ]);

  const haircutPrices = levels.map((l) => l.haircutPrice);
  const factServices: FactService[] = services.map((svc) => {
    const own = variants.filter((v) => v.serviceId === svc.id);
    const fromPrice =
      svc.priceType === "by_level"
        ? Math.min(...haircutPrices)
        : svc.priceType === "variant"
          ? Math.min(...own.map((v) => v.price))
          : (svc.price ?? svc.priceFrom ?? 0);
    return {
      name: svc.name,
      slug: svc.slug,
      category: svc.category,
      price: priceLabel({ ...svc, variants: own }, haircutPrices),
      fromPrice: Number.isFinite(fromPrice) ? fromPrice : 0,
      description: svc.description,
      durationMin: svc.durationMin,
      variants: own.map((v) => ({ name: v.name, price: v.price })),
      bookableOnline: bookableOnline(svc),
    };
  });

  const dayKey = DAY_KEYS[weekday(today)] ?? "mon";
  const factBranches: FactBranch[] = await Promise.all(
    branches.map(async (b) => {
      const queue = await getBranchQueue(b.slug, today, now, db);
      const hours = b.openHours[dayKey];
      return {
        name: b.name,
        slug: b.slug,
        address: b.address,
        mapsUrl: b.mapsUrl,
        hoursToday: hours ? `${clockLabel(hours[0])}–${clockLabel(hours[1])}` : null,
        closedReason: queue?.closedReason ?? (hours ? null : "tidak buka hari ini"),
        barbers: (queue?.barbers ?? []).map((x) => ({
          name: x.barber.name,
          level: x.barber.level,
          price: x.barber.haircutPrice,
          waiting: x.entries.length,
          waitMin: x.waitMin,
        })),
      };
    }),
  );

  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const factBarbers: FactBarber[] = barbers
    .sort((a, b) => b.level.sort - a.level.sort || a.barber.name.localeCompare(b.barber.name))
    .map(({ barber, level }) => ({
      name: barber.name,
      level: level.name,
      price: level.haircutPrice,
      bio: barber.bio,
      week: barberWeek(barber.id, shifts, closures, today).map((d) => ({
        day: DAY_NAMES[weekday(d.date)] ?? d.date,
        where:
          d.kind === "working"
            ? (branchName.get(d.branchId) ?? null)
            : d.kind === "off"
              ? "libur"
              : d.kind === "closed"
                ? `${branchName.get(d.branchId) ?? "cabang"} tutup (${d.reason})`
                : null,
      })),
    }));

  return {
    brand: brand.name,
    city: brand.city,
    now: `${shortDate(today)}, ${shopClock(now)}`,
    siteUrl,
    complaintsWa: brand.whatsappComplaints,
    levels: levels.map((l) => ({ name: l.name, price: l.haircutPrice })),
    services: factServices,
    branches: factBranches,
    barbers: factBarbers,
    membership: {
      fee: shopRules.membershipFee,
      pointsPer: shopRules.points.earnPer,
      redeemPoints: shopRules.points.redeemPoints,
      redeemValue: shopRules.points.redeemValue,
      birthdayPercent: shopRules.birthday.percent,
      birthdayCategories: shopRules.birthday.categories,
      topups: shopRules.packages.filter((p) => p.isActive).map((p) => ({ pay: p.pay, get: p.get })),
    },
  };
}
