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
  myRole: string;
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
            <button
              onClick={() => signIn("google")}
              className="w-full px-6 py-3 rounded-lg border transition-colors"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 13,
                background: "#1a1916",
                borderColor: "#2a2720",
                color: "#e0ddd5",
              }}
            >
              Sign in with Google
            </button>
            <button
              onClick={() => signIn("github")}
              className="w-full px-6 py-3 rounded-lg border transition-colors"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 13,
                background: "#1a1916",
                borderColor: "#2a2720",
                color: "#e0ddd5",
              }}
            >
              Sign in with GitHub
            </button>
            <button
              onClick={() =>
                signIn("credentials", {
                  email: "sm@scriptus.dev",
                  role: "STAGE_MANAGER",
                })
              }
              className="w-full px-6 py-3 rounded-lg border transition-colors"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 13,
                background: "#E8C54710",
                borderColor: "#E8C54730",
                color: "#E8C547",
              }}
            >
              Demo Login (Stage Manager)
            </button>
          </div>

          <p
            className="mt-6 text-xs"
            style={{ fontFamily: "DM Mono, monospace", color: "#555" }}
          >
            Run `npm run db:seed` to populate demo data
          </p>
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
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: "Playfair Display, serif", color: "#E8C547" }}
          >
            ◆ SCRIPTUS
          </h1>
          <p
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              color: "#666",
            }}
          >
            Welcome back, {session?.user?.name || "Director"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => signOut()}
            className="px-4 py-2.5 rounded-lg transition-colors"
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
            className="px-5 py-2.5 rounded-lg transition-colors"
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
          <p
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              color: "#555",
              marginTop: 8,
            }}
          >
            Create a new production or run `npm run db:seed` for demo data
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
              <div className="flex items-start justify-between">
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
                  {p.myRole?.replace("_", " ")}
                </span>
              </div>

              <div
                className="flex gap-6 mt-4"
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
    </div>
  );
}
