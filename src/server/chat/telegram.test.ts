import { describe, expect, it } from "vitest";
import { readUpdate, replyBody, secretMatches } from "./telegram";

const update = (message: object) => ({ update_id: 1, message });

describe("readUpdate", () => {
  it("reads a private text message", () => {
    expect(readUpdate(update({ text: "harga?", chat: { id: 42, type: "private" } }))).toEqual({
      chatId: "42",
      text: "harga?",
    });
  });
  it("turns /start into a greeting", () => {
    expect(readUpdate(update({ text: "/start", chat: { id: 42, type: "private" } }))?.text).toBe("halo");
  });
  it("ignores groups, stickers and junk", () => {
    expect(readUpdate(update({ text: "hai", chat: { id: -5, type: "group" } }))).toBeNull();
    expect(readUpdate(update({ sticker: {}, chat: { id: 42, type: "private" } }))).toBeNull();
    expect(readUpdate({ edited_message: {} })).toBeNull();
    expect(readUpdate(null)).toBeNull();
  });
});

describe("secretMatches", () => {
  it("accepts only the exact secret", () => {
    expect(secretMatches("s3cret-value-123456", "s3cret-value-123456")).toBe(true);
    expect(secretMatches("s3cret-value-12345", "s3cret-value-123456")).toBe(false);
    expect(secretMatches(null, "s3cret-value-123456")).toBe(false);
  });
});

describe("replyBody", () => {
  it("asks Telegram to send the answer to the same chat", () => {
    expect(replyBody("42", "Halo")).toMatchObject({ method: "sendMessage", chat_id: "42", text: "Halo" });
  });
});
