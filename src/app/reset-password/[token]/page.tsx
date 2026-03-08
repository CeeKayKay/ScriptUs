"use client";

import { useState, use } from "react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function ResetPasswordPage({ params: paramsPromise }: PageProps) {
  const params = use(paramsPromise);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        setSubmitting(false);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const inputStyle = {
    fontFamily: "DM Mono, monospace",
    fontSize: 13,
    background: "var(--stage-bg)",
    border: "1px solid var(--stage-border)",
    color: "var(--stage-text)",
  };

  const labelStyle = {
    fontFamily: "DM Mono, monospace",
    fontSize: 10,
    color: "var(--stage-muted)",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1
            className="text-3xl font-bold mb-4"
            style={{ fontFamily: "Playfair Display, serif", color: "var(--stage-gold)" }}
          >
            Password Reset
          </h1>
          <p
            className="mb-6"
            style={{ fontFamily: "Libre Baskerville, serif", color: "var(--stage-muted)", fontSize: 15 }}
          >
            Your password has been updated successfully.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-lg transition-colors"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 13,
              fontWeight: 600,
              background: "#E8C54715",
              border: "1px solid #E8C54740",
              color: "var(--stage-gold)",
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1
          className="text-3xl font-bold mb-2 text-center"
          style={{ fontFamily: "Playfair Display, serif", color: "var(--stage-gold)" }}
        >
          ◆ SCRIPTUS
        </h1>
        <p
          className="text-center mb-6"
          style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--stage-dim)" }}
        >
          Set a new password
        </p>

        <div
          className="p-5 rounded-xl space-y-4"
          style={{ background: "var(--stage-surface)", border: "1px solid var(--stage-border)" }}
        >
          {error && (
            <p style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--stage-error)" }}>
              {error}
            </p>
          )}

          <div>
            <label className="block mb-1.5" style={labelStyle}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-4 py-2.5 rounded-lg outline-none"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label className="block mb-1.5" style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-4 py-2.5 rounded-lg outline-none"
              style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !password || !confirm}
            className="w-full px-5 py-2.5 rounded-lg transition-colors"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 13,
              fontWeight: 600,
              background: "#E8C54715",
              border: "1px solid #E8C54740",
              color: "var(--stage-gold)",
              opacity: submitting || !password || !confirm ? 0.5 : 1,
            }}
          >
            {submitting ? "Resetting..." : "Reset Password"}
          </button>
        </div>

        <div className="text-center mt-4">
          <Link
            href="/"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--stage-dim)" }}
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
