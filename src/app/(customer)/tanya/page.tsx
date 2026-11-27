import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { ChatBox } from "./chat-box";

export const metadata: Metadata = {
  title: "Tanya",
  description: `Tanya harga, antrean, cabang, barber dan member ${brand.name}.`,
};

/** The web chat. The same bot answers on Telegram. */
export default function AskPage() {
  return <ChatBox />;
}
