"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";

export function PasswordForm() {
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const current = String(data.get("current") ?? "");
    const next = String(data.get("next") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    const found: Record<string, string> = {};
    if (!current) found.current = "Enter your current password.";
    if (next.length < 10) found.next = "Use at least 10 characters.";
    if (next.length > 128) found.next = "Use at most 128 characters.";
    if (next && next === current) found.next = "Choose a password you haven’t been using.";
    if (confirm !== next) found.confirm = "Passwords don’t match.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setPending(true);
    try {
      const res = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
      if (res.error) {
        setErrors(res.error.status === 429 ? { form: "Too many attempts. Wait a minute and try again." } : { current: "That isn’t your current password." });
        return;
      }
      form.reset();
      toast.success("Password changed. Other devices were signed out.");
    } catch {
      setErrors({ form: "Can’t reach the server. Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError message={errors.form} />
      <TextField label="Current password" name="current" type="password" autoComplete="current-password" error={errors.current} />
      <TextField label="New password" name="next" type="password" autoComplete="new-password" hint="At least 10 characters." error={errors.next} />
      <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />
      <div>
        <Button type="submit" size="sm" pending={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}
