import { ButtonLink } from "@/components/button";
import { Wordmark } from "@/components/wordmark";

/** A number nobody is going to call. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Wordmark />
      <div className="ticket mt-8 w-48 -rotate-3 [--notch:0.5rem] [--tear:7rem]" aria-hidden>
        <div className="flex h-28 flex-col justify-center px-5">
          <span className="text-sm text-white/80">Nomor antrean</span>
          <span className="condensed num text-6xl leading-none font-semibold">404</span>
        </div>
        <div className="ticket-tear mx-5" />
        <p className="px-5 py-3 text-sm text-white/80">Tidak akan dipanggil</p>
      </div>
      <h1 className="mt-8 text-[1.75rem]">Halaman ini tidak ada</h1>
      <p className="mt-2 text-muted">Mungkin tautannya salah ketik atau sudah lama.</p>
      <ButtonLink href="/" variant="dark" className="mt-6 self-start">
        Ke beranda
      </ButtonLink>
    </main>
  );
}
