"use client";

import { FormEvent, useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const { dictionary } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError(dictionary.login.invalidEmail);
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/area-personale`,
        },
      });

      if (signInError) {
        logAuthError("Supabase Auth signInWithOtp error", signInError);
        setError(dictionary.login.error);
        return;
      }

      setMessage(dictionary.login.success);
    } catch (catchError) {
      logAuthError("Supabase Auth signInWithOtp unexpected error", catchError);
      setError(dictionary.login.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium text-[#5f524c]">
        {dictionary.login.emailLabel}
        <input
          className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/70 px-4 py-3 text-base text-[#211815] outline-none transition focus:border-[#8b5e4a]"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder={dictionary.login.emailPlaceholder}
          required
        />
      </label>

      <button
        className="w-full rounded-full bg-[#211815] px-5 py-3 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
        type="submit"
        disabled={loading}
      >
        {loading ? dictionary.login.submitting : dictionary.login.submit}
      </button>

      {message ? (
        <p className="rounded-[8px] border border-[#2f5b3a]/20 bg-[#2f5b3a]/8 p-3 text-sm leading-6 text-[#2f5b3a]">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/8 p-3 text-sm leading-6 text-[#8b2f2a]">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function logAuthError(label: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(label, error);
  }
}
