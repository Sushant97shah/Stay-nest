"use client";

import { createContext, useCallback, useContext, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWishlist } from "@/hooks/useWishlist";

type AuthMode = "tenant" | "owner";
type TenantMethod = "phone" | "email";
type Step = "form" | "otp" | "check-email";

interface AuthModalContextValue {
  openLogin: (mode?: AuthMode) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}

async function ownerAuthRequest(email: string, password: string, name: string) {
  const signinRes = await fetch("/api/owner-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "signin", email, password }),
  });
  const signinResult = await signinRes.json();
  if (signinRes.ok && signinResult.ok) return signinResult;

  const signupRes = await fetch("/api/owner-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "signup", email, password, name }),
  });
  const signupResult = await signupRes.json();
  if (!signupRes.ok || !signupResult.ok) {
    throw new Error(signupResult.error || signinResult.error || "Owner sign-in/sign-up failed.");
  }
  return signupResult;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const { supabase, configured, refreshSession } = useAuth();
  const { reload: reloadWishlist } = useWishlist();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("tenant");
  const [tenantMethod, setTenantMethod] = useState<TenantMethod>("phone");
  const [step, setStep] = useState<Step>("form");
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openLogin = useCallback((nextMode: AuthMode = "tenant") => {
    setMode(nextMode);
    setStep("form");
    setError("");
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setStep("form");
    setError("");
  }, []);

  async function handleOwnerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const name = String(form.get("name") || "").trim();
    if (!email || !password || !name) return;
    if (!supabase) {
      setError("Backend isn't configured yet.");
      return;
    }
    setBusy(true);
    try {
      const result = await ownerAuthRequest(email, password, name);
      const accessToken = result.session?.access_token || "";
      const refreshToken = result.session?.refresh_token || "";
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
      await refreshSession();
      await reloadWishlist();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Owner auth failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTenantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    if (!supabase) {
      setError("OTP login needs the backend to be configured (Supabase keys not set).");
      return;
    }
    setBusy(true);
    try {
      if (tenantMethod === "phone") {
        const phone = String(form.get("phone") || "").replace(/\D/g, "");
        if (phone.length !== 10) return;
        const e164Phone = `+91${phone}`;
        const { error: sendError } = await supabase.auth.signInWithOtp({
          phone: e164Phone,
          options: { data: { role: "tenant", full_name: name } },
        });
        if (sendError) throw sendError;
        setPendingPhone(e164Phone);
        setPendingName(name);
        setStep("otp");
      } else {
        const email = String(form.get("email") || "").trim();
        if (!email) return;
        const { error: sendError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            data: { role: "tenant", full_name: name },
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (sendError) throw sendError;
        setPendingEmail(email);
        setStep("check-email");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not send OTP. Make sure ${
              tenantMethod === "phone" ? "an SMS provider is configured in Supabase Auth settings" : "email sign-in is enabled in Supabase Auth settings"
            }.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase) return;
    const code = String(new FormData(event.currentTarget).get("otp") || "").replace(/\D/g, "");
    setBusy(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token: code,
        type: "sms",
      });
      if (verifyError) throw verifyError;
      const user = data.user;
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: pendingName,
          role: "tenant",
          phone: pendingPhone,
          updated_at: new Date().toISOString(),
        });
      }
      await refreshSession();
      await reloadWishlist();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthModalContext.Provider value={{ openLogin }}>
      {children}
      {isOpen && (
        <div className="modal" id="modal" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="modal-card">
            <button className="modal-close" type="button" onClick={close}>
              ×
            </button>

            {step === "form" && (
              <div className="auth-card">
                <div className="auth-header">
                  <span className="eyebrow">WELCOME</span>
                  <h2>{mode === "owner" ? "Owner login" : "Tenant login"}</h2>
                </div>
                <div className="auth-toggle">
                  <button
                    type="button"
                    className={`auth-tab ${mode !== "owner" ? "active" : ""}`}
                    onClick={() => {
                      setMode("tenant");
                      setError("");
                    }}
                  >
                    Tenant
                  </button>
                  <button
                    type="button"
                    className={`auth-tab ${mode === "owner" ? "active" : ""}`}
                    onClick={() => {
                      setMode("owner");
                      setError("");
                    }}
                  >
                    Owner
                  </button>
                </div>

                {mode === "owner" ? (
                  <form className="auth-form" onSubmit={handleOwnerSubmit}>
                    <label>
                      Full name
                      <input required name="name" placeholder="Owner name" />
                    </label>
                    <label>
                      Email
                      <input required type="email" name="email" placeholder="owner@email.com" />
                    </label>
                    <label>
                      Password
                      <input required type="password" name="password" placeholder="Create a secure password" />
                    </label>
                    <button className="btn btn-dark auth-submit" type="submit" disabled={busy}>
                      {configured ? "Sign up / Sign in" : "Create owner account"}
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="auth-toggle">
                      <button
                        type="button"
                        className={`auth-tab ${tenantMethod === "phone" ? "active" : ""}`}
                        onClick={() => setTenantMethod("phone")}
                      >
                        📱 Phone
                      </button>
                      <button
                        type="button"
                        className={`auth-tab ${tenantMethod === "email" ? "active" : ""}`}
                        onClick={() => setTenantMethod("email")}
                      >
                        ✉️ Email
                      </button>
                    </div>
                    <form className="auth-form" onSubmit={handleTenantSubmit}>
                      {tenantMethod === "phone" ? (
                        <label>
                          Mobile number
                          <input required type="tel" name="phone" placeholder="Enter 10-digit mobile number" maxLength={10} />
                        </label>
                      ) : (
                        <label>
                          Email
                          <input required type="email" name="email" placeholder="you@email.com" />
                        </label>
                      )}
                      <label>
                        Name
                        <input required name="name" placeholder="Full name" />
                      </label>
                      <button className="btn btn-dark auth-submit" type="submit" disabled={busy}>
                        {configured ? "Send OTP" : "Continue"}
                      </button>
                    </form>
                    <p className="otp-copy">
                      {configured
                        ? `We'll ${tenantMethod === "phone" ? "text you a 6-digit verification code." : "email you a sign-in link — click it to log in."}`
                        : "OTP login needs the backend configured — ask the site admin."}
                    </p>
                  </>
                )}
                {error && <p className="otp-copy" style={{ color: "#c0392b" }}>{error}</p>}
              </div>
            )}

            {step === "check-email" && (
              <div className="auth-card">
                <div className="auth-header">
                  <span className="eyebrow">CHECK YOUR EMAIL</span>
                  <h2>Sign-in link sent</h2>
                </div>
                <p className="otp-copy">
                  We emailed a sign-in link to <strong>{pendingEmail}</strong>. Open that email and click the link to finish signing in.
                </p>
                <p className="otp-copy">
                  If you opened the link in a new tab, you can close this one — you&apos;ll already be signed in there. Didn&apos;t get it? Check spam, or close this and try again.
                </p>
              </div>
            )}

            {step === "otp" && (
              <div className="auth-card">
                <div className="auth-header">
                  <span className="eyebrow">VERIFY</span>
                  <h2>Enter verification code</h2>
                </div>
                <p className="otp-copy">
                  We sent a 6-digit code via SMS to <strong>{pendingPhone}</strong>.
                </p>
                <form className="auth-form" onSubmit={handleOtpSubmit}>
                  <label>
                    OTP
                    <input required name="otp" inputMode="numeric" maxLength={6} placeholder="123456" />
                  </label>
                  <button className="btn btn-dark auth-submit" type="submit" disabled={busy}>
                    Verify
                  </button>
                </form>
                {error && <p className="otp-copy" style={{ color: "#c0392b" }}>{error}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </AuthModalContext.Provider>
  );
}
