import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Cloud,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import { getSettings, getUser, login, requestPasswordRecovery, signup } from "@netlify/identity";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/provider";
import { describeAuthError } from "@/lib/auth/errors";
import { PALETTE } from "@/lib/palette";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: Login });

type Mode = "signin" | "signup" | "recover";
type Sent = "signup" | "recover" | null;

const HEART = [
  "00000000",
  "08800880",
  "08888880",
  "08888880",
  "00888800",
  "00088000",
  "00000000",
  "00000000",
] as const;

function PixelHeart() {
  return (
    <div
      className="grid w-fit grid-cols-8 gap-px"
      aria-hidden="true"
      style={{ imageRendering: "pixelated" }}
    >
      {HEART.flatMap((row, y) =>
        [...row].map((cell, x) => (
          <span
            key={`${x}-${y}`}
            className="size-4 sm:size-[18px]"
            style={{
              backgroundColor:
                cell === "8" ? (y === 1 && x === 2 ? PALETTE[14] : PALETTE[8]) : "transparent",
            }}
          />
        )),
      )}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase"
        >
          {label}
        </label>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-md border border-input bg-well px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

function Login() {
  const navigate = useNavigate();
  const { user, isPending, refresh } = useAuth();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent>(null);
  const [settings, setSettings] = useState<{
    autoconfirm: boolean;
    disableSignup: boolean;
    email: boolean;
  } | null>(null);
  const [settingsError, setSettingsError] = useState(false);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((next) => {
        if (!active) return;
        setSettings({
          autoconfirm: next.autoconfirm,
          disableSignup: next.disableSignup,
          email: next.providers.email,
        });
        if (next.disableSignup) setMode((current) => (current === "signup" ? "signin" : current));
      })
      .catch(() => {
        if (active) setSettingsError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const canSignUp = settings ? !settings.disableSignup && settings.email : true;
  const emailEnabled = settings ? settings.email : true;
  const title = useMemo(() => {
    if (sent === "signup") return "Check your inbox";
    if (sent === "recover") return "Reset link sent";
    if (mode === "signup") return "Create your account";
    if (mode === "recover") return "Reset your password";
    return "Welcome back";
  }, [mode, sent]);

  if (!isPending && user && !sent) {
    return <Navigate to="/" replace />;
  }

  const changeMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSent(null);
    setPassword("");
    setConfirm("");
    setShowPassword(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }
    if (!emailEnabled) {
      setError("Email sign-in is not enabled for this site.");
      return;
    }
    if (mode !== "recover") {
      if (password.length < 8) {
        setError("Use at least 8 characters for your password.");
        return;
      }
      if (mode === "signup" && password !== confirm) {
        setError("The passwords don’t match.");
        return;
      }
    }

    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await login(cleanEmail, password);
        await refresh();
        navigate({ to: "/", replace: true });
      } else if (mode === "signup") {
        await signup(cleanEmail, password);
        // With autoconfirm on, Identity logs the new user in immediately.
        const session = await getUser().catch(() => null);
        if (session) {
          await refresh();
          navigate({ to: "/", replace: true });
          return;
        }
        setSent("signup");
      } else {
        await requestPasswordRecovery(cleanEmail);
        setSent("recover");
      }
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-start gap-10 px-5 py-10 sm:px-8 lg:grid lg:grid-cols-[1.05fr_minmax(0,25rem)] lg:items-center lg:justify-center lg:gap-16 lg:py-16">
        <section className="order-2 space-y-8 lg:order-1">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Pixel Pad home"
          >
            <span className="grid size-6 grid-cols-2 gap-px" aria-hidden="true">
              <span className="bg-foreground" />
              <span className="bg-muted-foreground" />
              <span className="bg-muted-foreground" />
              <span className="bg-foreground" />
            </span>
            <span className="font-mono text-sm font-medium tracking-tight">Pixel Pad</span>
          </Link>

          <div className="max-w-md space-y-4">
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              A PICO-8 pixel studio
            </p>
            <h1 className="font-mono text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl">
              Your sprites, on every screen.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in with an email and a password to keep one sprite library across devices. No
              account needed to draw or export a PNG.
            </p>
          </div>

          <div className="flex items-end gap-5">
            <PixelHeart />
            <div className="pb-1">
              <p className="font-mono text-[11px] text-muted-foreground">8×8 · PICO-8</p>
              <p className="font-mono text-[11px] text-muted-foreground/70">16 colours</p>
            </div>
          </div>

          <ul className="grid max-w-md gap-2.5 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-1">
            {[
              { icon: Cloud, label: "Save sprites to your account" },
              { icon: MonitorSmartphone, label: "Open them on any device" },
              { icon: Download, label: "Export crisp PNGs any time" },
              { icon: ShieldCheck, label: "Email and password only" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-secondary text-secondary-foreground ring-1 ring-border">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="auth-heading"
          className="order-1 w-full rounded-xl border border-border bg-card p-5 shadow-border sm:p-6 lg:order-2"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="auth-heading" className="font-mono text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              Email
            </span>
          </div>

          {sent ? (
            <SentPanel
              kind={sent}
              email={email.trim()}
              onBack={() => changeMode("signin")}
              onChangeEmail={() => {
                setSent(null);
                setError(null);
                setPassword("");
                setConfirm("");
                setMode(sent === "signup" ? "signup" : "recover");
              }}
            />
          ) : (
            <>
              <div
                role="tablist"
                aria-label="Account action"
                className="mb-5 grid grid-cols-2 gap-1 rounded-md bg-well p-1"
              >
                {(
                  [
                    ["signin", "Sign in"],
                    ["signup", "Create account"],
                  ] as const
                ).map(([value, label]) => {
                  const selected = mode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      disabled={value === "signup" && !canSignUp}
                      onClick={() => changeMode(value)}
                      className={cn(
                        "h-8 rounded-sm text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
                        selected
                          ? "bg-secondary text-foreground shadow-border"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {settingsError ? (
                <p
                  role="status"
                  className="mb-4 rounded-md border border-border bg-well px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                >
                  Can’t reach the sign-in service here. Accounts run on the deployed Netlify site —
                  drawing and PNG export still work offline.
                </p>
              ) : null}

              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <Field id={emailId} label="Email">
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      id={emailId}
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      disabled={busy}
                      className={cn(inputClass, "pl-9")}
                    />
                  </div>
                </Field>

                {mode !== "recover" ? (
                  <Field
                    id={passwordId}
                    label="Password"
                    hint={mode === "signup" ? "8+ characters" : undefined}
                  >
                    <div className="relative">
                      <input
                        id={passwordId}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        required
                        minLength={8}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={mode === "signup" ? "Choose a password" : "Your password"}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : undefined}
                        disabled={busy}
                        className={cn(inputClass, "pr-11")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </Field>
                ) : null}

                {mode === "signup" ? (
                  <Field id={confirmId} label="Confirm password">
                    <input
                      id={confirmId}
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      placeholder="Repeat the password"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      disabled={busy}
                      className={inputClass}
                    />
                  </Field>
                ) : null}

                <div aria-live="polite">
                  {error ? (
                    <p
                      id={errorId}
                      role="alert"
                      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>

                <Button type="submit" className="w-full" disabled={busy || !emailEnabled}>
                  {busy ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : mode === "recover" ? (
                    <Mail aria-hidden="true" />
                  ) : (
                    <ArrowRight aria-hidden="true" />
                  )}
                  {busy
                    ? "Working…"
                    : mode === "signin"
                      ? "Sign in"
                      : mode === "signup"
                        ? "Create account"
                        : "Send reset link"}
                </Button>
              </form>

              <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                {mode === "signin" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => changeMode("recover")}
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Forgot password?
                    </button>
                    {canSignUp ? (
                      <button
                        type="button"
                        onClick={() => changeMode("signup")}
                        className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        Create account
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => changeMode("signin")}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <Link
              to="/"
              className="underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Back to the canvas
            </Link>
            <span className="font-mono text-[10px] tracking-wide uppercase">No social logins</span>
          </div>
        </section>
      </div>
    </main>
  );
}

function SentPanel({
  kind,
  email,
  onBack,
  onChangeEmail,
}: {
  kind: Exclude<Sent, null>;
  email: string;
  onBack: () => void;
  onChangeEmail: () => void;
}) {
  const isSignup = kind === "signup";
  return (
    <div className="space-y-4">
      <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-border">
        <Check className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {isSignup ? (
          <>
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email || "your email"}</span>. Open it to
            finish creating your account, then sign in.
          </>
        ) : (
          <>
            If an account exists for{" "}
            <span className="font-medium text-foreground">{email || "that email"}</span>, a password
            reset link is on its way. It expires in an hour.
          </>
        )}
      </p>
      <div className="rounded-md border border-border bg-well px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {isSignup
          ? "Confirming on this device signs you in automatically."
          : "Open the link on any device to choose a new password."}
      </div>
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" className="w-full" onClick={onBack}>
          Back to sign in
        </Button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {isSignup ? "Use a different email" : "Send to a different email"}
        </button>
      </div>
    </div>
  );
}
