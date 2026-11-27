import "server-only";
import { generateText } from "ai";
import type { ShopFacts } from "@/domain/chat";
import { env } from "@/server/env";
import { instructions } from "./prompt";

export type Turn = { role: "user" | "bot"; text: string };

/** On when CHAT_AI=1 and the deployment can reach Vercel AI Gateway (an API key, or OIDC on Vercel). */
export function aiEnabled(): boolean {
  const e = env();
  return e.CHAT_AI === "1" && Boolean(e.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

/**
 * One answer from the language model through Vercel AI Gateway. Throws on any
 * failure; the caller falls back to the rule brain.
 */
export async function aiReply(facts: ShopFacts, history: Turn[], text: string): Promise<string> {
  const { text: answer } = await generateText({
    model: env().CHAT_MODEL,
    instructions: instructions(facts),
    messages: [
      ...history.map((t) => ({
        role: t.role === "user" ? ("user" as const) : ("assistant" as const),
        content: t.text,
      })),
      { role: "user" as const, content: text },
    ],
    maxOutputTokens: 400,
    temperature: 0.3,
    maxRetries: 1,
    timeout: 12_000,
  });
  const clean = answer.trim();
  if (!clean) throw new Error("Empty AI answer");
  return clean;
}
