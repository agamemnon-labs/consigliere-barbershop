"use client";

import { useActionState } from "react";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { forgotPin, type ResetState } from "@/server/actions/membership";

export function ResetPinForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(forgotPin, {});
  const phone = state.values?.phone;
  if (!state.sent) {
    return (
      <form action={action} className="grid gap-5">
        <Field
          label="Nomor WhatsApp"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={phone}
          error={state.error}
        />
        <Button type="submit" variant="dark" block disabled={pending} className="mt-1">
          {pending ? "Mengirim…" : "Kirim kode"}
        </Button>
      </form>
    );
  }
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="phone" value={phone ?? ""} />
      <Notice tone="ok" title="Kode terkirim">
        Kalau {phone} terdaftar sebagai member, kodenya sudah masuk WhatsApp. Berlaku 10 menit.
      </Notice>
      {state.demoCode ? (
        <Notice tone="info" title="Mode demo">
          WhatsApp belum tersambung, jadi kodenya kami tampilkan di sini:{" "}
          <span className="num">{state.demoCode}</span>
        </Notice>
      ) : null}
      <Field
        label="Kode dari WhatsApp"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
      />
      <Field
        label="PIN baru, 6 angka"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        maxLength={6}
        required
      />
      <Field
        label="Ulangi PIN baru"
        name="pin2"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        maxLength={6}
        required
        error={state.error}
      />
      <Button type="submit" variant="dark" block disabled={pending} className="mt-1">
        {pending ? "Menyimpan…" : "Simpan PIN baru"}
      </Button>
      <button
        type="submit"
        name="step"
        value="send"
        formNoValidate
        className="min-h-12 text-[0.9375rem] font-medium text-blue hover:underline"
      >
        Kirim ulang kode
      </button>
    </form>
  );
}
