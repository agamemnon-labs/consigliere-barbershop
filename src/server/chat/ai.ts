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

/** The model that answered last, tried first next time so a cold start pays the search once. */
let working: string | undefined;

export function chatModels(list = env().CHAT_MODEL): string[] {
  return list
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/** The account may not use this model (free tier, unknown id): worth trying the next one. */
export function modelUnavailable(error: unknown): boolean {
  const e = error as { statusCode?: number; message?: string } | null;
  if (e?.statusCode === 401 || e?.statusCode === 403 || e?.statusCode === 404) return true;
  return /free tier|not found|no_providers|does not have access/i.test(e?.message ?? "");
}

/**
 * One answer from the language model through Vercel AI Gateway, trying each model in
 * `CHAT_MODEL` until one is allowed. Throws when none answers; the caller falls back to
 * the rule brain.
 */
export async function aiReply(facts: ShopFacts, history: Turn[], text: string): Promise<string> {
  const all = chatModels();
  const order = working && all.includes(working) ? [working, ...all.filter((m) => m !== working)] : all;
  let last: unknown = new Error("No chat model configured");
  for (const model of order) {
    try {
      const answer = await once(model, facts, history, text);
      working = model;
      return answer;
    } catch (error) {
      last = error;
      if (!modelUnavailable(error)) break;
      console.warn(`Chat AI model ${model} not available, trying the next one`);
    }
  }
  throw last;
}

async function once(model: string, facts: ShopFacts, history: Turn[], text: string): Promise<string> {
  const { text: answer } = await generateText({
    model,
    instructions: instructions(facts),
    messages: [
      ...history.map((t) => ({
        role: t.role === "user" ? ("user" as const) : ("assistant" as const),
        content: t.text,
      })),
      { role: "user" as const, content: text },
    ],
    maxOutputTokens: 500,
    temperature: 0.4,
    maxRetries: 0,
    timeout: 12_000,
  });
  const clean = answer.trim();
  if (!clean) throw new Error("Empty AI answer");
  return clean;
}
