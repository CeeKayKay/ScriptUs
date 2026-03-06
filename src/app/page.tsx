"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ProjectSummary {
  id: string;
  title: string;
  subtitle: string | null;
  memberCount: number;
  cueCount: number;
  sceneCount: number;
  updatedAt: string;
  myRoles: string[];
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/projects")
        .then((r) => r.json())
        .then((data) => {
          setProjects(data.projects || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  // --- Login form state ---
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  // --- Delete account ---
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This will remove you from all productions and cannot be undone.")) return;
    if (!confirm("This is permanent. Type OK in the next prompt to confirm.")) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (res.ok) {
        signOut({ callbackUrl: "/" });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete account");
        setDeleting(false);
      }
    } catch {
      alert("Failed to delete account");
      setDeleting(false);
    }
  };

  // Not logged in — show landing
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <h1
            className="text-5xl font-bold mb-4"
            style={{ fontFamily: "Playfair Display, serif", color: "#E8C547" }}
          >
            ◆ SCRIPTUS
          </h1>
          <p
            className="text-lg mb-8"
            style={{ fontFamily: "Libre Baskerville, serif", color: "#8a8070" }}
          >
            Real-time collaborative script management for theater productions.
            Annotate cues, manage props, coordinate lighting — all in one shared
            document.
          </p>

          <div className="space-y-3">
            {!showEmailForm ? (
              <button
                onClick={() => setShowEmailForm(true)}
                className="w-full px-6 py-3 rounded-lg border transition-colors hover:bg-white/3"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 13,
                  background: "#E8C54715",
                  borderColor: "#E8C54740",
                  color: "#E8C547",
                }}
              >
                Sign in / Create Account
              </button>
            ) : (
              <div
                className="p-5 rounded-xl space-y-3 text-left"
                style={{ background: "#1a1916", border: "1px solid #2a2720" }}
              >
                {/* Toggle between Sign In and Create Account */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #2a2720" }}>
                  <button
                    onClick={() => { setIsSignUp(false); setLoginError(""); }}
                    className="flex-1 py-2 text-center transition-colors"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 11,
                      background: !isSignUp ? "#E8C54715" : "transparent",
                      color: !isSignUp ? "#E8C547" : "#666",
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { setIsSignUp(true); setLoginError(""); }}
                    className="flex-1 py-2 text-center transition-colors"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 11,
                      background: isSignUp ? "#E8C54715" : "transparent",
                      color: isSignUp ? "#E8C547" : "#666",
                      borderLeft: "1px solid #2a2720",
                    }}
                  >
                    Create Account
                  </button>
                </div>

                {loginError && (
                  <p style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#E84747" }}>
                    {loginError}
                  </p>
                )}

                <div>
                  <label
                    className="block mb-1.5"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 10,
                      color: "#888",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-2.5 rounded-lg outline-none"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 13,
                      background: "#13120f",
                      border: "1px solid #2a2720",
                      color: "#e0ddd5",
                    }}
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    className="block mb-1.5"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 10,
                      color: "#888",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={isSignUp ? "Create a password" : "Enter your password"}
                    required
                    className="w-full px-4 py-2.5 rounded-lg outline-none"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 13,
                      background: "#13120f",
                      border: "1px solid #2a2720",
                      color: "#e0ddd5",
                    }}
                  />
                </div>

                {isSignUp && (
                  <div>
                    <label
                      className="block mb-1.5"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 10,
                        color: "#888",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-2.5 rounded-lg outline-none"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 13,
                        background: "#13120f",
                        border: "1px solid #2a2720",
                        color: "#e0ddd5",
                      }}
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={async () => {
                      if (!loginEmail.trim() || !loginPassword) return;
                      setLoginSubmitting(true);
                      setLoginError("");
                      const res = await signIn("credentials", {
                        email: loginEmail.trim(),
                        password: loginPassword,
                        name: loginName.trim() || undefined,
                        isSignUp: isSignUp ? "true" : "false",
                        redirect: false,
                      });
                      if (res?.error) {
                        setLoginError(res.error);
                        setLoginSubmitting(false);
                      } else {
                        window.location.href = "/";
                      }
                    }}
                    disabled={loginSubmitting || !loginEmail.trim() || !loginPassword}
                    className="flex-1 px-5 py-2.5 rounded-lg transition-colors"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 13,
                      fontWeight: 600,
                      background: "#E8C54715",
                      border: "1px solid #E8C54740",
                      color: "#E8C547",
                      opacity: loginSubmitting || !loginEmail.trim() || !loginPassword ? 0.5 : 1,
                    }}
                  >
                    {loginSubmitting ? (isSignUp ? "Creating..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}
                  </button>
                  <button
                    onClick={() => { setShowEmailForm(false); setLoginError(""); }}
                    className="px-4 py-2.5 rounded-lg transition-colors hover:bg-white/5"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 13,
                      color: "#888",
                      border: "1px solid #333",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="animate-pulse-dot text-2xl"
          style={{ color: "#E8C547" }}
        >
          ◆
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-10 gap-3">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold mb-1"
            style={{ fontFamily: "Playfair Display, serif", color: "#E8C547" }}
          >
            ◆ SCRIPTUS
          </h1>
          <p
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: 20,
              color: "#c8c0b0",
            }}
          >
            Welcome back, {session?.user?.name || "Director"}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => signOut()}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-colors"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              background: "#1a1916",
              border: "1px solid #2a2720",
              color: "#888",
            }}
          >
            Sign Out
          </button>
          <Link
            href="/project/new"
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg transition-colors"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              background: "#E8C54715",
              border: "1px solid #E8C54740",
              color: "#E8C547",
            }}
          >
            + New Production
          </Link>
        </div>
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl border"
          style={{
            background: "#1a1916",
            borderColor: "#2a2720",
          }}
        >
          <div className="text-4xl mb-4">🎭</div>
          <p
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: 20,
              color: "#8a8070",
            }}
          >
            No productions yet
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/project/${p.id}`}
              className="block p-6 rounded-xl border transition-all hover:border-opacity-50"
              style={{
                background: "#1a1916",
                borderColor: "#2a2720",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <h2
                    className="text-xl font-semibold mb-1"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    {p.title}
                  </h2>
                  {p.subtitle && (
                    <p
                      style={{
                        fontFamily: "Libre Baskerville, serif",
                        fontSize: 13,
                        color: "#8a8070",
                        fontStyle: "italic",
                      }}
                    >
                      {p.subtitle}
                    </p>
                  )}
                </div>
                <span
                  className="px-3 py-1 rounded-md text-xs"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    background: "#E8C54710",
                    color: "#E8C547",
                    border: "1px solid #E8C54720",
                  }}
                >
                  {(p.myRoles || []).map((r: string) => r.replace(/_/g, " ")).join(", ")}
                </span>
              </div>

              <div
                className="flex flex-wrap gap-3 sm:gap-6 mt-3 sm:mt-4"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 11,
                  color: "#666",
                }}
              >
                <span>{p.sceneCount} scenes</span>
                <span>{p.cueCount} cues</span>
                <span>{p.memberCount} members</span>
                <span className="ml-auto">
                  Updated {new Date(p.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Delete account */}
      <div className="flex justify-end mt-12 mb-4">
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="px-3 py-2 rounded-lg transition-colors hover:bg-red-500/10"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            border: "1px solid rgba(232, 71, 71, 0.2)",
            color: "#E84747",
            opacity: deleting ? 0.5 : 0.6,
          }}
        >
          {deleting ? "Deleting..." : "Delete Account"}
        </button>
      </div>
    </div>
  );
}
