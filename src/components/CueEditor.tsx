"use client";

import { useState, useEffect } from "react";
import { useStageStore } from "@/lib/store";
import { CUE_TYPES, CUE_TYPE_LIST } from "@/lib/cue-types";
import type { CueType, CueStatus } from "@/types";

interface CueEditorProps {
  projectId: string;
}

export function CueEditor({ projectId }: CueEditorProps) {
  const { editingCue, closeCueEditor, scenes, activeRole } = useStageStore();
  const isEditing = !!editingCue;

  const [type, setType] = useState<CueType>(editingCue?.type || "LIGHT");
  const [label, setLabel] = useState(editingCue?.label || "");
  const [number, setNumber] = useState(editingCue?.number || 1);
  const [note, setNote] = useState(editingCue?.note || "");
  const [status, setStatus] = useState<CueStatus>(editingCue?.status || "DRAFT");
  const [duration, setDuration] = useState(editingCue?.duration || 0);
  const [preWait, setPreWait] = useState(editingCue?.preWait || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate label from type and number
  useEffect(() => {
    if (!isEditing) {
      const config = CUE_TYPES[type];
      setLabel(`${config.label} Q${number}`);
    }
  }, [type, number, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const sceneId = scenes[0]?.id; // Default to first scene
      if (!sceneId) {
        setError("No scenes available");
        setSaving(false);
        return;
      }

      const body = {
        ...(isEditing && { id: editingCue.id }),
        projectId,
        sceneId: editingCue?.sceneId || sceneId,
        lineId: editingCue?.lineId || null,
        type,
        label,
        number,
        note,
        status,
        duration: duration || null,
        preWait: preWait || null,
      };

      const res = await fetch("/api/cues", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save cue");
      }

      closeCueEditor();
      // In a real app, we'd update the store or refetch
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCue || !confirm("Delete this cue?")) return;

    try {
      const res = await fetch(`/api/cues?id=${editingCue.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      closeCueEditor();
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-lg rounded-xl animate-fade-in"
        style={{
          background: "#1a1916",
          border: "1px solid #2a2720",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #2a2720" }}
        >
          <h2
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {isEditing ? "Edit Cue" : "New Cue"}
          </h2>
          <button
            onClick={closeCueEditor}
            className="text-sm px-2 py-1 rounded hover:bg-white/5"
            style={{ fontFamily: "DM Mono, monospace", color: "#888" }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div
              className="px-3 py-2 rounded text-sm"
              style={{
                background: "rgba(232, 120, 71, 0.1)",
                border: "1px solid rgba(232, 120, 71, 0.3)",
                color: "#E87847",
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {/* Type selector */}
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
              Cue Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CUE_TYPE_LIST.map((ct) => (
                <button
                  key={ct.type}
                  onClick={() => setType(ct.type)}
                  className="px-3 py-1.5 rounded transition-all"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 11,
                    fontWeight: type === ct.type ? 700 : 400,
                    color: type === ct.type ? ct.color : "#666",
                    background:
                      type === ct.type ? ct.color + "15" : "transparent",
                    border: `1px solid ${
                      type === ct.type ? ct.color + "40" : "#333"
                    }`,
                  }}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label and Number */}
          <div className="flex gap-3">
            <div className="flex-1">
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
                Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 rounded"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 13,
                  background: "#13120f",
                  border: "1px solid #2a2720",
                  color: "#e0ddd5",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ width: 90 }}>
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
                Cue #
              </label>
              <input
                type="number"
                value={number}
                onChange={(e) => setNumber(parseFloat(e.target.value) || 0)}
                step={0.1}
                min={0}
                className="w-full px-3 py-2 rounded"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 13,
                  background: "#13120f",
                  border: "1px solid #2a2720",
                  color: "#e0ddd5",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Note */}
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
              Cue Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Describe the cue execution..."
              className="w-full px-3 py-2 rounded resize-none"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                lineHeight: 1.6,
                background: "#13120f",
                border: "1px solid #2a2720",
                color: "#e0ddd5",
                outline: "none",
              }}
            />
          </div>

          {/* Timing */}
          <div className="flex gap-3">
            <div className="flex-1">
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
                Duration (sec)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
                step={0.5}
                min={0}
                className="w-full px-3 py-2 rounded"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 13,
                  background: "#13120f",
                  border: "1px solid #2a2720",
                  color: "#e0ddd5",
                  outline: "none",
                }}
              />
            </div>
            <div className="flex-1">
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
                Pre-wait (sec)
              </label>
              <input
                type="number"
                value={preWait}
                onChange={(e) => setPreWait(parseFloat(e.target.value) || 0)}
                step={0.5}
                min={0}
                className="w-full px-3 py-2 rounded"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 13,
                  background: "#13120f",
                  border: "1px solid #2a2720",
                  color: "#e0ddd5",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Status */}
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
              Status
            </label>
            <div className="flex gap-1.5">
              {(["DRAFT", "REVIEW", "APPROVED", "LOCKED"] as CueStatus[]).map(
                (s) => {
                  const colors: Record<CueStatus, string> = {
                    DRAFT: "#E87847",
                    REVIEW: "#E8C547",
                    APPROVED: "#47E86A",
                    LOCKED: "#888",
                  };
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className="px-3 py-1.5 rounded transition-all"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 10,
                        fontWeight: status === s ? 700 : 400,
                        color: status === s ? colors[s] : "#666",
                        background:
                          status === s ? colors[s] + "15" : "transparent",
                        border: `1px solid ${
                          status === s ? colors[s] + "40" : "#333"
                        }`,
                      }}
                    >
                      {s}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: "1px solid #2a2720" }}
        >
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded transition-colors hover:bg-red-500/10"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 11,
                  color: "#E87847",
                  border: "1px solid rgba(232, 120, 71, 0.3)",
                }}
              >
                Delete Cue
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={closeCueEditor}
              className="px-4 py-2 rounded transition-colors hover:bg-white/5"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                color: "#888",
                border: "1px solid #333",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !label || !note}
              className="px-4 py-2 rounded transition-colors"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                fontWeight: 600,
                color: "#E8C547",
                background: "#E8C54715",
                border: "1px solid #E8C54740",
                opacity: saving || !label || !note ? 0.5 : 1,
              }}
            >
              {saving ? "Saving..." : isEditing ? "Update Cue" : "Create Cue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
