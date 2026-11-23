"use client";

import { useActionState } from "react";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { type FormState, signInMember } from "@/server/actions/membership";

export function MemberSignInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signInMember, {});
  return (
    <form action={action} className="grid gap-5">
      <Field
        label="Nomor WhatsApp"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        defaultValue={state.values?.phone}
      />
      <Field
        label="PIN"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        maxLength={6}
        required
        error={state.error}
      />
      <Button type="submit" variant="dark" block disabled={pending} className="mt-1">
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
