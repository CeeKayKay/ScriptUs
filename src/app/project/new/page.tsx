"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScriptImport } from "@/components/ScriptImport";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  async function createProject() {
    if (!title.trim() || submitting) return null;
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), subtitle: subtitle.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) return data.project.id as string;
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = await createProject();
    if (id) router.push(`/project/${id}`);
  }

  async function handleCreateAndImport() {
    const id = await createProject();
    if (id) setCreatedProjectId(id);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
        <div>
          <Link
            href="/"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--stage-dim)" }}
          >
            ← Back
          </Link>
          <h1
            className="text-3xl font-bold mt-4"
            style={{ fontFamily: "Playfair Display, serif", color: "var(--stage-gold)" }}
          >
            New Production
          </h1>
        </div>

        <div>
          <label
            className="block mb-2"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--stage-muted)" }}
          >
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Evening Hour"
            required
            className="w-full px-4 py-3 rounded-lg outline-none focus:ring-1"
            style={{
              fontFamily: "Libre Baskerville, serif",
              fontSize: 16,
              background: "var(--stage-surface)",
              border: "1px solid var(--stage-border)",
              color: "var(--stage-text)",
            }}
          />
        </div>

        <div>
          <label
            className="block mb-2"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--stage-muted)" }}
          >
            Subtitle (optional)
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="e.g. A Play in Two Acts"
            className="w-full px-4 py-3 rounded-lg outline-none focus:ring-1"
            style={{
              fontFamily: "Libre Baskerville, serif",
              fontSize: 16,
              background: "var(--stage-surface)",
              border: "1px solid var(--stage-border)",
              color: "var(--stage-text)",
            }}
          />
        </div>

        <div className="space-y-3">
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="w-full px-5 py-3 rounded-lg transition-colors disabled:opacity-40"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 13,
              background: "#E8C54715",
              border: "1px solid #E8C54740",
              color: "var(--stage-gold)",
            }}
          >
            {submitting ? "Creating..." : "Create Production"}
          </button>

          <button
            type="button"
            onClick={handleCreateAndImport}
            disabled={!title.trim() || submitting}
            className="w-full px-5 py-3 rounded-lg transition-colors disabled:opacity-40"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 13,
              background: "transparent",
              border: "1px solid var(--stage-border)",
              color: "var(--stage-muted)",
            }}
          >
            Create &amp; Import Script
          </button>
        </div>
      </form>

      {createdProjectId && (
        <ScriptImport
          projectId={createdProjectId}
          onClose={() => router.push(`/project/${createdProjectId}`)}
          onImported={() => {}}
        />
      )}
    </div>
  );
}
