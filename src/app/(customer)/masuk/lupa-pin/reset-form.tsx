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
      <form action={action} className="grid gap-6">
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
        <Button type="submit" block disabled={pending}>
          {pending ? "Mengirim…" : "Kirim kode"}
        </Button>
      </form>
    );
  }
  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="phone" value={phone ?? ""} />
      <p className="text-muted">
        Kalau {phone} terdaftar sebagai member, kodenya sudah dikirim. Berlaku 10 menit.
      </p>
      {state.demoCode ? (
        <Notice title="Mode demo">
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
      <Button type="submit" block disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan PIN baru"}
      </Button>
      <button type="submit" name="step" value="send" formNoValidate className="label min-h-12 hover:text-fg">
        Kirim ulang kode
      </button>
    </form>
  );
}
