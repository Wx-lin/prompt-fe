"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { safeReturnTo } from "@/lib/auth/return-to";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { useScrollLock } from "@/lib/scroll/use-scroll-lock";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Link, useRouter } from "@/i18n/navigation";
import styles from "./login-page.module.css";

type LoginStep = "email" | "code";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              type?: string;
              theme?: string;
              size?: string;
              width?: number;
              text?: string;
              shape?: string;
              logo_alignment?: string;
            }
          ) => void;
        };
      };
    };
  }
}

export function LoginPage() {
  useScrollLock();
  const t = useTranslations("login");
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<LoginStep>("email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      setBusy(true);
      setMessage("");
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: response.credential }),
        });
        if (!res.ok) {
          const data: unknown = await res.json().catch(() => null);
          const msg =
            typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
              ? data.message
              : t("loginFailed");
          setMessage(msg);
          return;
        }
        router.push(returnTo);
        router.refresh();
      } catch {
        setMessage(t("loginFailed"));
      } finally {
        setBusy(false);
      }
    },
    [router, t, returnTo]
  );

  useEffect(() => {
    if (!clientId || !googleButtonRef.current) return;

    const scriptId = "google-gsi-script";
    const existing = document.getElementById(scriptId);

    const initGoogle = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        use_fedcm_for_prompt: false,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: googleButtonRef.current.offsetWidth || 464,
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
      });
    };

    if (existing) {
      initGoogle();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, [clientId, handleGoogleCredential]);

  function closeLogin(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/send-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!response.ok) throw new Error(t("codeSendFailed"));
      setStep("code");
      setMessage(t("codeSent"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("codeSendUnavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
      if (!response.ok) throw new Error(t("codeInvalid"));
      router.push(returnTo);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <section className={styles.dialog} aria-labelledby="login-title">
        <header className={styles.dialogHeader}>
          <BrandLogo size="compact" />
          <Link href="/" onClick={closeLogin} className={styles.close} aria-label={t("closeAriaLabel")}>×</Link>
        </header>
        <h1 id="login-title">{t("heading")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
        {clientId ? (
          <div ref={googleButtonRef} className={styles.googleWrapper} />
        ) : (
          <button type="button" className={styles.google} onClick={() => setMessage(t("googleUnavailable"))}>
            <svg className={styles.googleMark} viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
              <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
              <path fill="#FBBC05" d="M11.69 28.18A13.98 13.98 0 0 1 10.89 24c0-1.45.25-2.86.7-4.18v-5.7H4.34A21.98 21.98 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
              <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
            </svg>
            {t("google")}
          </button>
        )}
        <div className={styles.divider}><span>{t("divider")}</span></div>
        <form onSubmit={step === "email" ? sendCode : verifyCode}>
          <label htmlFor="email">{t("emailLabel")}</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("emailPlaceholder")} />
          {step === "code" && <><label htmlFor="code">{t("codeLabel")}</label><input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder={t("codePlaceholder")} /></>}
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? t("verifying") : step === "email" ? t("sendCode") : t("verifyAndLogin")}</button>
          {step === "code" && <button className={styles.resend} type="button" onClick={() => setStep("email")}>{t("resend")}</button>}
        </form>
        {step === "email" && <p className={styles.hint}>{t("hint")}</p>}
        <p className={styles.message} role="status">{message}</p>
        <p className={styles.terms}>{t("termsPrefix")}<a href="#">{t("termsService")}</a>{t("termsAnd")}<a href="#">{t("termsPrivacy")}</a>{t("termsSuffix")}</p>
      </section>
    </main>
  );
}
