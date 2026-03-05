"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), subtitle: subtitle.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/project/${data.project.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
        <div>
          <Link
            href="/"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#666" }}
          >
            &larr; Back
          </Link>
          <h1
            className="text-3xl font-bold mt-4"
            style={{ fontFamily: "Playfair Display, serif", color: "#E8C547" }}
          >
            New Production
          </h1>
        </div>

        <div>
          <label
            className="block mb-2"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#888" }}
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
              background: "#1a1916",
              border: "1px solid #2a2720",
              color: "#e0ddd5",
            }}
          />
        </div>

        <div>
          <label
            className="block mb-2"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#888" }}
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
              background: "#1a1916",
              border: "1px solid #2a2720",
              color: "#e0ddd5",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="w-full px-5 py-3 rounded-lg transition-colors disabled:opacity-40"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 13,
            background: "#E8C54715",
            border: "1px solid #E8C54740",
            color: "#E8C547",
          }}
        >
          {submitting ? "Creating..." : "Create Production"}
        </button>
      </form>
    </div>
  );
}
