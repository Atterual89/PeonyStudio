"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/site/LanguageProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 30;

export function LoginForm() {
  const { dictionary } = useLanguage();
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [normalizedEmail, setNormalizedEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);

  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown() {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownTimer.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current!);
          cooldownTimer.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const norm = email.trim().toLowerCase();
    if (!isValidEmail(norm)) {
      setError(dictionary.login.invalidEmail);
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: norm,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/area-personale`,
        },
      });

      if (signInError) {
        logAuthError("signInWithOtp error", signInError);
        setError(dictionary.login.error);
        return;
      }

      setNormalizedEmail(norm);
      setCode("");
      setResendSuccess(false);
      startCooldown();
      setStep("code");
    } catch (err) {
      logAuthError("signInWithOtp unexpected error", err);
      setError(dictionary.login.error);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoadingVerify(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const verifyError = await verifyOtpWithFallback(supabase, normalizedEmail, code);

      if (verifyError) {
        logAuthError("verifyOtp error (email + signup)", verifyError);
        setError(dictionary.login.invalidCode);
        return;
      }

      router.push("/area-personale");
      router.refresh();
    } catch (err) {
      logAuthError("verifyOtp unexpected error", err);
      setError(dictionary.login.invalidCode);
    } finally {
      setLoadingVerify(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendSuccess(false);
    setLoadingResend(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/area-personale`,
        },
      });

      if (resendError) {
        logAuthError("resend OTP error", resendError);
        setError(dictionary.login.error);
        return;
      }

      setCode("");
      setResendSuccess(true);
      startCooldown();
    } catch (err) {
      logAuthError("resend OTP unexpected error", err);
      setError(dictionary.login.error);
    } finally {
      setLoadingResend(false);
    }
  }

  function handleBackToEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setResendSuccess(false);
  }

  if (step === "code") {
    return (
      <form className="mt-7 space-y-4" onSubmit={handleVerify}>
        <p className="rounded-[8px] border border-[#2f5b3a]/20 bg-[#2f5b3a]/8 p-3 text-sm leading-6 text-[#2f5b3a]">
          {dictionary.login.successWithCode}
        </p>

        <p className="text-sm leading-6 text-[#5f524c]">
          {dictionary.login.codeStepIntro}
        </p>

        <label className="block text-sm font-medium text-[#5f524c]">
          {dictionary.login.codeLabel}
          <input
            className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/70 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-[#211815] outline-none transition focus:border-[#8b5e4a]"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder={dictionary.login.codePlaceholder}
            autoComplete="one-time-code"
            autoFocus
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-full bg-[#211815] px-5 py-3 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
            type="submit"
            disabled={loadingVerify || code.length !== 6}
          >
            {loadingVerify
              ? dictionary.login.verifying
              : dictionary.login.verifyButton}
          </button>

          <button
            className="rounded-full border border-[#8b5e4a] px-5 py-3 text-sm font-semibold text-[#8b5e4a] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loadingResend}
          >
            {loadingResend
              ? "..."
              : cooldown > 0
                ? dictionary.login.resendCooldown.replace(
                    "{seconds}",
                    String(cooldown),
                  )
                : dictionary.login.resendButton}
          </button>
        </div>

        {resendSuccess ? (
          <p className="rounded-[8px] border border-[#2f5b3a]/20 bg-[#2f5b3a]/8 p-3 text-sm leading-6 text-[#2f5b3a]">
            {dictionary.login.resendSuccess}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/8 p-3 text-sm leading-6 text-[#8b2f2a]">
            {error}
          </p>
        ) : null}

        <button
          className="block text-sm text-[#8b5e4a] underline underline-offset-2 hover:no-underline"
          type="button"
          onClick={handleBackToEmail}
        >
          {dictionary.login.changeEmail}
        </button>
      </form>
    );
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

      {error ? (
        <p className="rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/8 p-3 text-sm leading-6 text-[#8b2f2a]">
          {error}
        </p>
      ) : null}
    </form>
  );
}

async function verifyOtpWithFallback(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  email: string,
  token: string,
) {
  const { error: emailError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (!emailError) return null;

  const { error: signupError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
  return signupError;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function logAuthError(label: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(label, error);
  }
}
