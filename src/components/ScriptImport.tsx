"use client";

import { useState, useRef } from "react";
interface ScriptImportProps {
  projectId: string;
  onClose: () => void;
  onImported: () => void;
}

const monoFont = "DM Mono, monospace";

export function ScriptImport({ projectId, onClose, onImported }: ScriptImportProps) {
  const [mode, setMode] = useState<"replace" | "append">("append");
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ scenesImported: number; totalLines: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    setError(null);
    setResult(null);

    if (inputMode === "file" && !file) {
      setError("Select a file to import");
      return;
    }
    if (inputMode === "paste" && !pasteText.trim()) {
      setError("Paste script text to import");
      return;
    }

    if (mode === "replace") {
      if (!confirm("This will DELETE all existing scenes and replace them with the imported script. Continue?")) {
        return;
      }
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.set("mode", mode);

      if (inputMode === "file" && file) {
        formData.set("file", file);
      } else {
        formData.set("text", pasteText);
      }

      const res = await fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        setImporting(false);
        return;
      }

      setResult(data.summary);
      onImported();
    } catch (e: any) {
      setError(e?.message || "Network error — please try again");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--stage-overlay)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--stage-surface)",
          border: "1px solid var(--stage-border)",
          borderRadius: 12,
          width: "min(560px, 92vw)",
          maxHeight: "85vh",
          overflow: "auto",
          padding: 28,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: 22, color: "var(--stage-gold)", margin: 0 }}>
            Import Script
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--stage-dim)",
              fontSize: 22,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <p style={{ fontFamily: monoFont, fontSize: 12, color: "var(--stage-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Upload a PDF or text file, or paste script text. The parser will detect scenes, dialogue,
          stage directions, songs, and transitions.
        </p>

        {/* Input mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["file", "paste"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setInputMode(m)}
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                padding: "6px 16px",
                borderRadius: 6,
                border: `1px solid ${inputMode === m ? "var(--stage-gold)" : "var(--stage-border)"}`,
                background: inputMode === m ? "#E8C54715" : "transparent",
                color: inputMode === m ? "var(--stage-gold)" : "var(--stage-muted)",
                cursor: "pointer",
              }}
            >
              {m === "file" ? "Upload File" : "Paste Text"}
            </button>
          ))}
        </div>

        {/* File upload */}
        {inputMode === "file" && (
          <div style={{ marginBottom: 16 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.text,.fountain"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                fontFamily: monoFont,
                fontSize: 13,
                padding: "12px 20px",
                borderRadius: 8,
                border: "2px dashed #2a2720",
                background: "var(--stage-bg)",
                color: file ? "var(--stage-gold)" : "var(--stage-dim)",
                cursor: "pointer",
                width: "100%",
                textAlign: "center",
              }}
            >
              {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "Click to select PDF or text file"}
            </button>
          </div>
        )}

        {/* Paste text */}
        {inputMode === "paste" && (
          <div style={{ marginBottom: 16 }}>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"ACT I\nSCENE 1: The Beginning\n\n(The stage is dark. A single spotlight appears.)\n\nHAMLET: To be or not to be..."}
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--stage-border)",
                background: "var(--stage-bg)",
                color: "var(--stage-text)",
                width: "100%",
                minHeight: 180,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        )}

        {/* Import mode */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontFamily: monoFont, fontSize: 10, color: "var(--stage-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Import Mode
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {([
              { id: "append" as const, label: "Append", desc: "Add to existing scenes" },
              { id: "replace" as const, label: "Replace", desc: "Delete existing, import fresh" },
            ]).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  fontFamily: monoFont,
                  fontSize: 12,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: `1px solid ${mode === m.id ? (m.id === "replace" ? "var(--stage-danger)" : "var(--stage-gold)") : "var(--stage-border)"}`,
                  background: mode === m.id ? (m.id === "replace" ? "#E8784715" : "#E8C54715") : "transparent",
                  color: mode === m.id ? (m.id === "replace" ? "var(--stage-danger)" : "var(--stage-gold)") : "var(--stage-muted)",
                  cursor: "pointer",
                  flex: 1,
                  textAlign: "center",
                }}
              >
                <div>{m.label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Format tips */}
        <details style={{ marginBottom: 20 }}>
          <summary style={{ fontFamily: monoFont, fontSize: 11, color: "var(--stage-dim)", cursor: "pointer" }}>
            Formatting tips
          </summary>
          <div style={{ fontFamily: monoFont, fontSize: 11, color: "#777", marginTop: 8, lineHeight: 1.8, paddingLeft: 8 }}>
            <div><span style={{ color: "var(--stage-gold)" }}>ACT I</span> or <span style={{ color: "var(--stage-gold)" }}>ACT 1</span> → Act header</div>
            <div><span style={{ color: "var(--stage-gold)" }}>SCENE 2: Title</span> → Scene break with title</div>
            <div><span style={{ color: "var(--stage-gold)" }}>CHARACTER:</span> dialogue → Dialogue line</div>
            <div><span style={{ color: "var(--stage-gold)" }}>CHARACTER</span> on its own line → Next lines are their dialogue</div>
            <div><span style={{ color: "var(--stage-gold)" }}>(text in parentheses)</span> → Stage direction</div>
            <div><span style={{ color: "var(--stage-gold)" }}>BLACKOUT / FADE TO BLACK</span> → Transition</div>
            <div><span style={{ color: "var(--stage-gold)" }}>SONG: Title</span> → Song/musical number</div>
          </div>
        </details>

        {/* Error */}
        {error && (
          <div style={{
            fontFamily: monoFont,
            fontSize: 12,
            color: "var(--stage-danger)",
            background: "#E8784710",
            border: "1px solid #E8784730",
            borderRadius: 6,
            padding: "8px 12px",
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Success */}
        {result && (
          <div style={{
            fontFamily: monoFont,
            fontSize: 12,
            color: "var(--stage-success)",
            background: "#47E86A10",
            border: "1px solid #47E86A30",
            borderRadius: 6,
            padding: "8px 12px",
            marginBottom: 16,
          }}>
            Imported {result.scenesImported} scene{result.scenesImported !== 1 ? "s" : ""} with {result.totalLines} line{result.totalLines !== 1 ? "s" : ""}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              padding: "8px 20px",
              borderRadius: 6,
              border: "1px solid var(--stage-border)",
              background: "transparent",
              color: "var(--stage-muted)",
              cursor: "pointer",
            }}
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 24px",
                borderRadius: 6,
                border: "1px solid #E8C547",
                background: importing ? "#E8C54730" : "#E8C54720",
                color: "var(--stage-gold)",
                cursor: importing ? "wait" : "pointer",
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing ? "Importing..." : "Import Script"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
