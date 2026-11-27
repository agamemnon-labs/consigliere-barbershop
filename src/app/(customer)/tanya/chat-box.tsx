"use client";

import { type FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { inputClass } from "@/components/field";
import { Screen } from "@/components/screen";

type Line = { id: number; from: "user" | "bot"; text: string };

const STORAGE_KEY = "consigliere-chat";
const SUGGESTIONS = ["Antrean sekarang", "Harga haircut", "Vito kerja di mana?", "Cara jadi member"];
const GREETING: Line = {
  id: 0,
  from: "bot",
  text: "Halo, aku asisten Consigliere. Tanya soal harga, antrean, cabang, barber, atau member.",
};

/** A browser-kept id for this phone's conversation, so the limit and the short memory hold across reloads. */
function chatId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Turns bare https links in an answer into links; everything else stays text. */
function withLinks(text: string) {
  let offset = 0;
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part) => {
    const key = offset;
    offset += part.length + 1;
    return /^https?:\/\//.test(part) ? (
      <a key={key} href={part} className="text-blue underline underline-offset-2" rel="noopener noreferrer">
        {part.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
}

export function ChatBox() {
  const [lines, setLines] = useState<Line[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const add = (from: Line["from"], text: string) => {
    const id = nextId.current++;
    setLines((l) => [...l, { id, from, text }]);
  };

  useEffect(() => {
    idRef.current = chatId();
  }, []);

  // Follow the newest line as the conversation grows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on purpose whenever a line is added
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setDraft("");
    setBusy(true);
    add("user", clean);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId: idRef.current ?? chatId(), text: clean }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      add("bot", data.text ?? data.error ?? "Maaf, coba lagi sebentar");
    } catch {
      add("bot", "Koneksinya putus. Coba kirim lagi");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <Screen
      back={{ href: "/", label: "Beranda" }}
      credits={false}
      bar={
        <form onSubmit={onSubmit} className="flex gap-2">
          <label htmlFor="pesan" className="sr-only">
            Pesan
          </label>
          <input
            id="pesan"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Tulis pertanyaan"
            className={`${inputClass} flex-1`}
          />
          <Button type="submit" disabled={busy || !draft.trim()}>
            Kirim
          </Button>
        </form>
      }
    >
      <h1 className="text-[2rem]">Tanya</h1>
      <p className="mt-2 text-muted">Jawaban dari data toko hari ini. Antrean bisa berubah tiap menit</p>

      <ol className="mt-6 flex flex-col gap-3" aria-live="polite">
        {lines.map((line) => (
          <li
            key={line.id}
            className={
              line.from === "user"
                ? "max-w-[85%] self-end rounded-2xl rounded-br-md bg-fg px-4 py-2.5 whitespace-pre-line text-bg"
                : "max-w-[90%] self-start rounded-2xl rounded-bl-md border border-rule bg-surface px-4 py-2.5 whitespace-pre-line"
            }
          >
            <span className="sr-only">{line.from === "user" ? "Kamu: " : "Consigliere: "}</span>
            {line.from === "bot" ? withLinks(line.text) : line.text}
          </li>
        ))}
        {busy ? (
          <li className="self-start rounded-2xl border border-rule bg-surface px-4 py-2.5 text-muted">
            Mengetik…
          </li>
        ) : null}
      </ol>

      {lines.length === 1 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s}
              variant="soft"
              type="button"
              className="min-h-11 px-4 text-[0.9375rem]"
              onClick={() => void send(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      ) : null}
      <div ref={endRef} />
    </Screen>
  );
}
