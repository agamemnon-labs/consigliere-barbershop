import type { ChangeEvent, ReactNode } from "react";
import { CheckIcon } from "./icons";

type ChoiceProps = {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  lead?: ReactNode;
  title: string;
  tag?: string;
  detail: string;
  detailTone?: "muted" | "ok";
  aside: string;
  inset?: boolean;
};

/** One tappable card: the whole card is the label, a check circle shows the choice. */
export function Choice({
  type,
  name,
  value,
  checked,
  onChange,
  lead,
  title,
  tag,
  detail,
  detailTone = "muted",
  aside,
  inset = false,
}: ChoiceProps) {
  return (
    <label
      className={`relative flex min-h-18 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition-[background-color,box-shadow] has-checked:bg-blue-soft/50 has-checked:ring-2 has-checked:ring-blue has-focus-visible:outline-2 has-focus-visible:outline-blue ${
        inset ? "bg-bg ring-transparent" : "bg-surface ring-transparent hover:ring-rule-strong"
      }`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-label={title}
        className="peer sr-only"
      />
      {lead}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="font-semibold">{title}</span>
          {tag ? <span className="text-sm text-faint">{tag}</span> : null}
        </span>
        <span
          className={`mt-0.5 block text-sm ${detailTone === "ok" ? "font-medium text-mint-ink" : "text-muted"}`}
        >
          {detail}
        </span>
      </span>
      <span className="num shrink-0 font-semibold">{aside}</span>
      <span
        aria-hidden
        className={`inline-flex size-6 shrink-0 items-center justify-center border-2 transition-colors ${
          type === "radio" ? "rounded-full" : "rounded-lg"
        } ${checked ? "border-blue bg-blue text-white" : "border-rule-strong bg-surface text-transparent"}`}
      >
        <CheckIcon size={14} strokeWidth={3} />
      </span>
    </label>
  );
}
