import { z } from "zod";
import { getDb } from "@/db";
import { ask, MAX_MESSAGE_LENGTH } from "@/server/chat/answer";
import { siteOrigin } from "@/server/chat/origin";

const body = z.object({
  /** A random id the browser keeps for its own conversation. */
  chatId: z.uuid(),
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

/** The web chat on /tanya. Same brain as Telegram. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Pesannya kosong atau terlalu panjang." }, { status: 400 });

  const answer = await ask(await getDb(), {
    channel: "web",
    chatId: parsed.data.chatId,
    text: parsed.data.text,
    now: new Date(),
    siteUrl: siteOrigin(request),
  });
  return Response.json({ text: answer.text });
}
