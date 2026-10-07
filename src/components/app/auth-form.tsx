"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { initializeSettingsAction } from "@/server/actions/settings";

type Mode = "sign-in" | "sign-up";
type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

function validate(mode: Mode, data: { name: string; email: string; password: string }): Errors {
  const errors: Errors = {};
  if (mode === "sign-up" && !data.name.trim()) errors.name = "What should we call you?";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = "Enter a valid email address.";
  if (mode === "sign-up" && data.password.length < 10) errors.password = "Use at least 10 characters.";
  if (mode === "sign-in" && !data.password) errors.password = "Enter your password.";
  return errors;
}

/** Maps auth API errors to plain language without revealing whether an email exists on sign-in. */
function friendlyError(mode: Mode, error: { status?: number; code?: string; message?: string }): string {
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (mode === "sign-in") return "That email and password don’t match. Check both and try again.";
  if (error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") return "An account with this email already exists. Sign in instead?";
  if (error.code === "PASSWORD_TOO_SHORT") return "Use at least 10 characters.";
  return "We couldn’t create your account right now. Please try again.";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const data = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") };
    const found = validate(mode, data);
    setErrors(found);
    if (Object.keys(found).length) return;

    setPending(true);
    try {
      const res =
        mode === "sign-up"
          ? await authClient.signUp.email({ name: data.name.trim(), email: data.email, password: data.password })
          : await authClient.signIn.email({ email: data.email, password: data.password });
      if (res.error) {
        setErrors({ form: friendlyError(mode, res.error) });
        return;
      }
      if (mode === "sign-up") {
        // Best effort: the user can always change this in Settings.
        await initializeSettingsAction({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).catch(() => undefined);
      }
      router.replace("/");
      router.refresh();
    } catch {
      setErrors({ form: "Can’t reach the server. Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    // method="post": if submitted before hydration, credentials must never land in the URL.
    <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="font-serif text-[40px] leading-[1.05]">{mode === "sign-up" ? "Start your almanac." : "Welcome back."}</h1>
      <p className="-mt-2 text-[14px] text-muted">
        {mode === "sign-up" ? "Your data is private to your account. You can export or delete it any time." : "Sign in to pick up where you left off."}
      </p>
      <FormError message={errors.form} />
      {mode === "sign-up" ? <TextField label="Name" name="name" autoComplete="name" maxLength={80} error={errors.name} /> : null}
      <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} error={errors.email} />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        maxLength={128}
        hint={mode === "sign-up" ? "At least 10 characters." : undefined}
        error={errors.password}
      />
      <Button type="submit" pending={pending} className="mt-2 w-full">
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-[13.5px] text-muted">
        {mode === "sign-up" ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold text-moss underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/sign-up" className="font-semibold text-moss underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
