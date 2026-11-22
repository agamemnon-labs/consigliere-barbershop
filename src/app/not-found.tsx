import { ButtonLink } from "@/components/button";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <Wordmark />
      <p className="num mt-16 text-6xl text-accent-ink">404</p>
      <h1 className="mt-6 text-3xl">Halaman ini tidak ada di buku kami</h1>
      <ButtonLink href="/" variant="quiet" className="mt-10">
        Kembali ke depan
      </ButtonLink>
    </main>
  );
}
