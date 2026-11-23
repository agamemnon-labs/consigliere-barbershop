import Link from "next/link";
import { brand } from "@/config/brand";

/** A quiet footer at the end of every customer page: complaints and who built it. */
export function Credits({ className = "" }: { className?: string }) {
  return (
    <footer className={`mt-12 border-t border-rule pt-2 pb-4 text-sm text-faint ${className}`}>
      <a
        href={`https://wa.me/${brand.whatsappComplaints}`}
        className="inline-flex min-h-11 items-center hover:text-fg"
      >
        Keluhan dan saran lewat WhatsApp
      </a>
      <p className="flex flex-wrap items-center gap-x-4">
        <span>
          © {brand.established} {brand.legalName}, {brand.city}
        </span>
        <Link href="/studi-kasus" className="inline-flex min-h-11 items-center hover:text-fg">
          Dibuat oleh {brand.builtBy.name}
        </Link>
      </p>
    </footer>
  );
}
