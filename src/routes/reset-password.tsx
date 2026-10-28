import { useId, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { updateUser } from "@netlify/identity";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/provider";
import { describeAuthError } from "@/lib/auth/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

const inputClass =
  "h-11 w-full rounded-md border border-input bg-well px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

function ResetPassword() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don’t match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await updateUser({ password });
      setDone(true);
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-10 sm:px-8">
        <Link
          to="/"
          className="mb-8 inline-flex w-fit items-center gap-2.5 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

        <section className="rounded-xl border border-border bg-card p-5 shadow-border sm:p-6">
          {isPending ? (
            <div className="flex items-center gap-2.5 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Checking your reset link…
            </div>
          ) : done ? (
            <div className="space-y-5">
              <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-border">
                <Check className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h1 className="font-mono text-lg font-semibold tracking-tight">Password updated</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  You’re signed in with the new password. Your saved sprites are right where you
                  left them.
                </p>
              </div>
              <Button type="button" className="w-full" onClick={() => navigate({ to: "/" })}>
                Open the studio
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          ) : !user ? (
            <div className="space-y-5">
              <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-border">
                <KeyRound className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h1 className="font-mono text-lg font-semibold tracking-tight">Link expired</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This password reset link is missing or has expired. Request a fresh one from the
                  sign-in page.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div className="space-y-2">
                <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-border">
                  <KeyRound className="size-5" aria-hidden="true" />
                </div>
                <h1 className="font-mono text-lg font-semibold tracking-tight">
                  Choose a new password
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {user.primaryEmail
                    ? `You’re resetting the password for ${user.primaryEmail}.`
                    : "Set a new password for your account."}
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={passwordId}
                  className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase"
                >
                  New password
                </label>
                <div className="relative">
                  <input
                    id={passwordId}
                    name="newPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8+ characters"
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
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={confirmId}
                  className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase"
                >
                  Confirm password
                </label>
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
              </div>

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

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
