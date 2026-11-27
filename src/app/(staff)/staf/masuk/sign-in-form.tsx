"use client";

import { useActionState } from "react";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { type SignInState, signInStaff } from "@/server/actions/auth";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInStaff, {});
  return (
    <form action={action} className="mt-6 grid gap-5" noValidate>
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
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-[0.9375rem] text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="dark" block disabled={pending} className="mt-1">
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
