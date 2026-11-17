import { BrandLogo } from "./BrandLogo";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";

type AuthStatus = {
  ok: boolean;
  mode: "accounts" | "demo";
  configured: boolean;
  authenticated: boolean;
  setupRequired?: boolean;
  recoveryEnabled?: boolean;
  provider?: string;
  csrfToken?: string;
  user?: { id: string; email: string } | null;
};
export type AccessContext = {
  mode: "accounts" | "demo";
  csrfToken: string;
  refresh: () => void;
  authError?: string;
  authBusy?: boolean;
};
type Activation = { tokenHash: string; type: "invite" | "recovery" };
// Consume a provider email link before rendering, routing or any request. The secret
// remains only in this module's memory, never in storage, analytics or messages.
let activation: Activation | null = null;
let unsupportedLink = false;
if (typeof window !== "undefined") {
  const url = new URL(window.location.href),
    type = url.searchParams.get("type"),
    hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has("token_hash")) {
    const value = url.searchParams.get("token_hash") || "";
    if (type === "invite" || type === "recovery")
      activation = { tokenHash: value, type };
    else unsupportedLink = true;
    history.replaceState(null, "", url.pathname + "#activate");
  } else if (hash.has("access_token") || hash.has("refresh_token")) {
    unsupportedLink = true;
    history.replaceState(null, "", url.pathname + "#sign-in");
  }
}
const examples = [
  {
    id: "admin",
    name: "Elena Torres",
    role: "Project Admin",
    description: "Manage projects, review deliverables and close the PRD.",
  },
  {
    id: "specialist",
    name: "Mateo Ruiz",
    role: "UX Specialist",
    description: "Work on assigned tasks and submit exact document versions.",
  },
  {
    id: "stakeholder",
    name: "Lucía Vega",
    role: "Stakeholder",
    description: "Answer the assigned project questionnaire.",
  },
  {
    id: "integration",
    name: "Nora Campos",
    role: "Integration administrator",
    description: "Inspect the separate company integration access layer.",
  },
  {
    id: "outsider",
    name: "Alex Silva",
    role: "Unassigned user",
    description: "Verify that unassigned projects remain inaccessible.",
  },
];
export function AuthGate({
  children,
}: {
  children: (
    actor: string,
    onSignOut: () => void,
    context: AccessContext,
  ) => ReactNode;
}) {
  const [status, setStatus] = useState<AuthStatus | null>(null),
    [selected, setSelected] = useState(
      sessionStorage.getItem("astra-evaluation-account") || "",
    );
  const [error, setError] = useState(
      unsupportedLink
        ? "This link format cannot establish a session. Request a new password reset email."
        : "",
    ),
    [notice, setNotice] = useState(""),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [isActivation, setIsActivation] = useState(!!activation),
    [recovery, setRecovery] = useState(unsupportedLink);
  const refresh = () => {
    setStatus(null);
    setReload((x) => x + 1);
  };
  useEffect(() => {
    let active = true;
    setStatus(null);
    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        const value = await res.json();
        if (!active) return;
        if (res.status === 401 && attempt === 0) continue;
        if (!res.ok || !value.ok || !["accounts", "demo"].includes(value.mode))
          throw new Error(res.status === 401 ? "SESSION_STATUS_RETRY" : "AUTH_STATUS_UNAVAILABLE");
        setStatus(value);
        return;
      }
    })()
      .catch((failure) => {
        if (active)
          setError(
            failure.message === "SESSION_STATUS_RETRY"
              ? "Your session ended. Use Try again to sign in."
              : "Astra could not be reached. Try again in a moment.",
          );
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const request = async (endpoint: string, body: Record<string, unknown>) => {
    const res = await fetch("/api/auth/" + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Csrf": status?.csrfToken || "",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok)
      throw new Error(
        data.error?.message || "The request could not be confirmed.",
      );
    return data as AuthStatus & { message?: string };
  };
  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    if (status?.mode === "accounts") {
      try {
        await request("sign-out", {});
      } catch {
        setError(
          "Sign-out could not be confirmed. Your local drafts have not been cleared. Export them before retrying, and do not assume this device is signed out.",
        );
        setBusy(false);
        return;
      }
    }
    sessionStorage.removeItem("astra-evaluation-account");
    setSelected("");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
    activation = null;
    setIsActivation(false);
    location.hash = "projects";
    setBusy(false);
    refresh();
  };
  const context: AccessContext = {
    mode: status?.mode || "accounts",
    csrfToken: status?.csrfToken || "",
    refresh,
    authError: error,
    authBusy: busy,
  };
  if (
    status?.mode === "demo" &&
    examples.some((account) => account.id === selected)
  )
    return children(selected, signOut, context);
  if (
    status?.mode === "accounts" &&
    status.authenticated &&
    status.user &&
    !isActivation
  )
    return children(status.user.id, signOut, context);
  const openExample = (id: string) => {
    sessionStorage.setItem("astra-evaluation-account", id);
    setSelected(id);
    location.hash = "projects";
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    if (recovery && status?.recoveryEnabled !== true) {
      setError(
        "Password recovery is not enabled yet. Email delivery and the secure return link must be verified first.",
      );
      return;
    }
    if (isActivation && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (recovery) {
        const result = await request("recover", { email });
        setNotice(result.message || "Check your email for a recovery link.");
      } else {
        const result = await request(
          isActivation ? "activate" : "sign-in",
          isActivation
            ? { email, password, ...activation }
            : { email, password },
        );
        activation = null;
        setIsActivation(false);
        setStatus(result);
        location.hash = "projects";
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The request could not be confirmed. Check your account before retrying.",
      );
    } finally {
      setPassword("");
      setConfirmPassword("");
      setBusy(false);
    }
  };
  return (
    <main className="access-page">
      <section
        className={
          "access-card " + (status?.mode === "demo" ? "evaluation-access" : "")
        }
      >
        <div className="access-brand">
          <BrandLogo />
        </div>
        {!status && !error ? (
          <div className="access-message" role="status">
            <h1>Opening Astra</h1>
            <p>Checking workspace access…</p>
          </div>
        ) : !status ? (
          <div className="access-message">
            <h1>Unable to connect</h1>
            <p role="alert">{error}</p>
            <button onClick={refresh}>
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        ) : status.mode === "demo" ? (
          <>
            <div className="access-message">
              <span className="eyebrow">LOCAL EVALUATION ONLY</span>
              <h1>Explore your workflow</h1>
              <p>
                Choose a synthetic account to evaluate its assigned work. No
                real account is signed in and no service is connected.
              </p>
            </div>
            <div className="evaluation-accounts">
              {examples.map((account) => (
                <button
                  key={account.id}
                  onClick={() => openExample(account.id)}
                >
                  <span className="avatar">
                    {account.name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")}
                  </span>
                  <span className="grow">
                    <strong>{account.name}</strong>
                    <span>{account.role}</span>
                    <small>{account.description}</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
            <p className="access-footnote">
              Synthetic data only. Evaluation accounts do not prove identity or
              grant real organizational access.
            </p>
          </>
        ) : status.configured ? (
          <div className="access-message">
            <span className="access-lock">
              <LockKeyhole size={24} />
            </span>
            <h1>
              {isActivation
                ? "Set your password"
                : recovery
                  ? "Reset your password"
                  : "Welcome to Astra"}
            </h1>
            <p>
              {isActivation
                ? "Confirm the email that received this invitation, then choose your password."
                : recovery
                  ? status.recoveryEnabled === true
                    ? "Request a secure link for your account email."
                    : "Password recovery is not enabled yet. Email delivery and the secure return link must be verified first."
                  : "Sign in to access the projects and roles assigned to your account."}
            </p>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="alert success" role="status">
                {notice}
              </div>
            )}
            {recovery && status.recoveryEnabled !== true ? (
              <p className="helper" role="status">
                No recovery email will be sent. You can return to sign in with
                your existing password.
              </p>
            ) : status.authenticated && isActivation ? (
              <>
                <p>
                  Sign out before accepting an invitation or resetting another
                  account’s password.
                </p>
                <button onClick={signOut}>Sign out</button>
              </>
            ) : (
              <form onSubmit={submit}>
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                    disabled={busy}
                  />
                </label>
                {!recovery && (
                  <label>
                    {isActivation ? "New password" : "Password"}
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={
                        isActivation ? "new-password" : "current-password"
                      }
                      required
                      minLength={isActivation ? 12 : undefined}
                      maxLength={1024}
                      disabled={busy}
                    />
                  </label>
                )}
                {isActivation && (
                  <>
                    <label>
                      Confirm password
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={12}
                        disabled={busy}
                      />
                    </label>
                    <p className="helper">
                      Use at least 12 characters. Enter your password here only,
                      never in a chat message.
                    </p>
                  </>
                )}
                <button type="submit" className="primary full" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : isActivation
                      ? "Set password & sign in"
                      : recovery
                        ? "Send recovery email"
                        : "Sign in"}
                </button>
              </form>
            )}
            <div className="actions" style={{ marginTop: 18 }}>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  activation = null;
                  setIsActivation(false);
                  setRecovery(!recovery && !isActivation);
                  setPassword("");
                  setConfirmPassword("");
                  setError("");
                  setNotice("");
                }}
              >
                {isActivation || recovery
                  ? "Back to sign in"
                  : "Forgot password?"}
              </button>
            </div>
            <p className="helper">
              Astra signs you out when the local service restarts. Your shared
              projects remain saved.
            </p>
          </div>
        ) : (
          <div className="access-message">
            <span className="access-lock">
              <LockKeyhole size={24} />
            </span>
            <h1>Your Astra workspace</h1>
            <p>Secure account access is being configured.</p>
            <div className="access-status">
              <ShieldCheck size={20} />
              <div>
                <strong>Account setup required</strong>
                <p>
                  A verified account and assigned permissions are required
                  before your projects can open.
                </p>
              </div>
            </div>
            <p className="helper">
              Sign-in is unavailable until the authentication provider and
              shared backend are connected. No password is requested or stored
              on this screen.
            </p>
            <button onClick={refresh}>
              <RefreshCw size={16} />
              Check setup status
            </button>
          </div>
        )}
        <div className="access-footer">Astra System · PRD v0.6</div>
      </section>
    </main>
  );
}
