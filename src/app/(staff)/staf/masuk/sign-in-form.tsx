"use client";

import { useActionState } from "react";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { type SignInState, signInStaff } from "@/server/actions/auth";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInStaff, {});
  return (
    <form action={action} className="mt-12 grid gap-8" noValidate>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        defaultValue={state.email}
      />
      <Field label="Kata sandi" name="password" type="password" autoComplete="current-password" required />
      {state.error ? (
        <p role="alert" className="border-l-2 border-accent pl-3 text-sm text-accent-ink">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" block disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
