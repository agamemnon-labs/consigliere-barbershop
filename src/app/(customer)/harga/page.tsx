import type { Metadata } from "next";
import { PriceList } from "@/components/price-list";
import { Screen } from "@/components/screen";

export const metadata: Metadata = {
  title: "Harga",
  description: "Harga potong, perawatan, chemical dan paket di semua cabang.",
};

/** The whole pricelist. Rows open downward for what's included and how long it takes. */
export default function PricesPage() {
  return (
    <Screen back={{ href: "/", label: "Beranda" }}>
      <h1 className="text-[2rem]">Harga</h1>
      <p className="mt-2 text-muted">Sama di tiga cabang. Ketuk layanan untuk lihat isinya</p>
      <div className="mt-6">
        <PriceList />
      </div>
    </Screen>
  );
}
