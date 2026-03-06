"use client";

import { useEffect, useState, use } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function InvitePage({ params: paramsPromise }: PageProps) {
  const params = use(paramsPromise);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${params.token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Invalid or expired invitation");
        return r.json();
      })
      .then(setInvite)
      .catch((e) => setError(e.message));
  }, [params.token]);

  const handleAccept = async () => {
    if (!session?.user) {
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${params.token}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invite");
      }
      const data = await res.json();
      router.push(`/project/${data.projectId}`);
    } catch (e: any) {
      setError(e.message);
      setAccepting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1
            className="text-3xl font-bold mb-4"
            style={{ fontFamily: "Playfair Display, serif", color: "#E8C547" }}
          >
            ◆ SCRIPTUS
          </h1>
          <p style={{ fontFamily: "DM Mono, monospace", fontSize: 14, color: "#E87847" }}>
            {error}
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 px-6 py-3 rounded-lg"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 13,
              background: "#1a1916",
              border: "1px solid #2a2720",
              color: "#888",
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse-dot text-2xl" style={{ color: "#E8C547" }}>◆</div>
      </div>
    );
  }

  const roleLabel = invite.role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ fontFamily: "Playfair Display, serif", color: "#E8C547" }}
        >
          ◆ SCRIPTUS
        </h1>
        <p
          className="mb-8"
          style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#666" }}
        >
          You&apos;ve been invited
        </p>

        <div
          className="p-6 rounded-xl mb-6"
          style={{ background: "#1a1916", border: "1px solid #2a2720" }}
        >
          <p
            className="text-xl mb-2"
            style={{ fontFamily: "Playfair Display, serif", color: "#e0ddd5" }}
          >
            {invite.projectTitle}
          </p>
          <p
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#888" }}
          >
            Role: <span style={{ color: "#47B8E8", fontWeight: 700 }}>{roleLabel}</span>
          </p>
          <p
            className="mt-2"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#666" }}
          >
            Invited by {invite.inviterName}
          </p>
        </div>

        {status === "unauthenticated" ? (
          <div
            className="p-5 rounded-xl space-y-3 text-left"
            style={{ background: "#1a1916", border: "1px solid #2a2720" }}
          >
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #2a2720" }}>
              <button
                onClick={() => { setIsSignUp(false); setAuthError(""); }}
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
                onClick={() => { setIsSignUp(true); setAuthError(""); }}
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

            {authError && (
              <p style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#E84747" }}>
                {authError}
              </p>
            )}

            <div>
              <label className="block mb-1.5" style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg outline-none"
                style={{ fontFamily: "DM Mono, monospace", fontSize: 13, background: "#13120f", border: "1px solid #2a2720", color: "#e0ddd5" }}
                autoFocus
              />
            </div>

            <div>
              <label className="block mb-1.5" style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? "Create a password" : "Enter your password"}
                className="w-full px-4 py-2.5 rounded-lg outline-none"
                style={{ fontFamily: "DM Mono, monospace", fontSize: 13, background: "#13120f", border: "1px solid #2a2720", color: "#e0ddd5" }}
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-lg outline-none"
                  style={{ fontFamily: "DM Mono, monospace", fontSize: 13, background: "#13120f", border: "1px solid #2a2720", color: "#e0ddd5" }}
                />
              </div>
            )}

            <button
              onClick={async () => {
                if (!email.trim() || !password) return;
                setAuthSubmitting(true);
                setAuthError("");
                const res = await signIn("credentials", {
                  email: email.trim(),
                  password,
                  name: name.trim() || undefined,
                  isSignUp: isSignUp ? "true" : "false",
                  redirect: false,
                });
                if (res?.error) {
                  setAuthError(res.error);
                  setAuthSubmitting(false);
                } else {
                  window.location.reload();
                }
              }}
              disabled={authSubmitting || !email.trim() || !password}
              className="w-full px-5 py-2.5 rounded-lg transition-colors"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 13,
                fontWeight: 600,
                background: "#E8C54715",
                border: "1px solid #E8C54740",
                color: "#E8C547",
                opacity: authSubmitting || !email.trim() || !password ? 0.5 : 1,
              }}
            >
              {authSubmitting ? (isSignUp ? "Creating..." : "Signing in...") : (isSignUp ? "Create Account & Join" : "Sign In & Join")}
            </button>
          </div>
        ) : (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full px-6 py-3 rounded-lg transition-colors"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 13,
              background: "#E8C54715",
              border: "1px solid #E8C54740",
              color: "#E8C547",
              opacity: accepting ? 0.5 : 1,
            }}
          >
            {accepting ? "Joining..." : "Accept & Join Production"}
          </button>
        )}
      </div>
    </div>
  );
}
