"use client";

import { useState, useEffect } from "react";
import { useStageStore } from "@/lib/store";
import { CUE_TYPES, CUE_TYPE_LIST } from "@/lib/cue-types";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { CueType, CueStatus } from "@/types";

interface CueEditorProps {
  projectId: string;
  broadcast?: (msg: any) => void;
}

export function CueEditor({ projectId, broadcast }: CueEditorProps) {
  const { editingCue, closeCueEditor, scenes, activeRole, newCueLineId, newCueSceneId, newCueSelectedText, addCueToLine, updateCueInStore, removeCueFromLine, reorderCuesInStore } = useStageStore();
  const isEditing = !!editingCue;
  const isMobile = useIsMobile();

  // Auto-select cue type based on active role
  const defaultType = (): CueType => {
    if (editingCue) return editingCue.type;
    const roleToType: Partial<Record<string, CueType>> = {
      LIGHTING: "LIGHT",
      SOUND: "SOUND",
      PROPS: "PROPS",
      SET_DESIGN: "SET",
      ACTOR: "BLOCKING",
      DIRECTOR: "BLOCKING",
      STAGE_MANAGER: "LIGHT",
    };
    return roleToType[activeRole] || "LIGHT";
  };

  // Auto-calculate next cue number for a given type
  const getNextNumber = (cueType: CueType): number => {
    let maxNum = 0;
    scenes.forEach((sc) =>
      sc.lines.forEach((l) =>
        l.cues.forEach((c) => {
          if (c.type === cueType && c.number > maxNum) maxNum = c.number;
        })
      )
    );
    return Math.floor(maxNum) + 1;
  };

  const initialType = defaultType();
  const [type, setType] = useState<CueType>(initialType);
  const [label, setLabel] = useState(editingCue?.label || "");
  const [number, setNumber] = useState(editingCue?.number || getNextNumber(initialType));
  const [note, setNote] = useState(editingCue?.note || "");
  const [status, setStatus] = useState<CueStatus>(editingCue?.status || "DRAFT");
  const [scriptRef, setScriptRef] = useState(editingCue?.scriptRef || newCueSelectedText || "");
  const [duration, setDuration] = useState(editingCue?.duration || 0);
  const [preWait, setPreWait] = useState(editingCue?.preWait || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find the full line text for context when editing
  const lineText = (() => {
    const lineId = editingCue?.lineId || newCueLineId;
    if (!lineId) return null;
    for (const scene of scenes) {
      for (const line of scene.lines) {
        if (line.id === lineId) return line.text;
      }
    }
    return null;
  })();

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
      const sceneId = editingCue?.sceneId || newCueSceneId || scenes[0]?.id;
      const lineId = editingCue?.lineId || newCueLineId || null;

      if (!sceneId) {
        setError("No scenes available");
        setSaving(false);
        return;
      }

      const body = {
        ...(isEditing && { id: editingCue.id }),
        projectId,
        sceneId,
        lineId,
        type,
        label,
        number,
        note,
        status,
        duration: duration || null,
        preWait: preWait || null,
        scriptRef: scriptRef.trim() || null,
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

      const data = await res.json();
      const savedCue = data.cue;

      // Update the store with the new/updated cue
      if (isEditing) {
        const updates = {
          type: savedCue.type,
          label: savedCue.label,
          number: savedCue.number,
          note: savedCue.note,
          status: savedCue.status,
          scriptRef: savedCue.scriptRef,
          duration: savedCue.duration,
          preWait: savedCue.preWait,
          followTime: savedCue.followTime,
          updatedAt: savedCue.updatedAt || new Date().toISOString(),
        };
        updateCueInStore(savedCue.id, updates);
        broadcast?.({ type: "cue-update", cueId: savedCue.id, updates });
      } else if (lineId && sceneId) {
        const newCue = {
          id: savedCue.id,
          type: savedCue.type,
          label: savedCue.label,
          number: savedCue.number,
          note: savedCue.note,
          status: savedCue.status,
          lineId: savedCue.lineId,
          sceneId: savedCue.sceneId,
          scriptRef: savedCue.scriptRef,
          duration: savedCue.duration,
          preWait: savedCue.preWait,
          followTime: savedCue.followTime,
          createdBy: savedCue.createdBy,
          updatedAt: savedCue.updatedAt || new Date().toISOString(),
        };
        addCueToLine(sceneId, lineId, newCue);
        broadcast?.({ type: "cue-add", sceneId, lineId, cue: newCue });
      }

      closeCueEditor();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCue || !confirm("Are you sure you want to delete this cue?")) return;

    try {
      const res = await fetch(`/api/cues?id=${editingCue.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      // Remove from store
      if (editingCue.lineId && editingCue.sceneId) {
        removeCueFromLine(editingCue.sceneId, editingCue.lineId, editingCue.id);
        broadcast?.({ type: "cue-delete", sceneId: editingCue.sceneId, lineId: editingCue.lineId, cueId: editingCue.id });
      }

      // Renumber remaining cues of same type
      const remaining: string[] = [];
      scenes.forEach((sc) =>
        sc.lines.forEach((l) =>
          l.cues
            .filter((c) => c.type === editingCue.type && c.id !== editingCue.id)
            .sort((a, b) => a.number - b.number)
            .forEach((c) => remaining.push(c.id))
        )
      );
      if (remaining.length > 0) {
        reorderCuesInStore(editingCue.type, remaining);
        fetch("/api/cues/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cues: remaining.map((id, idx) => ({ id, number: idx + 1 })) }),
        });
      }

      closeCueEditor();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--stage-overlay)" }}
    >
      <div
        className="w-full animate-fade-in"
        style={{
          background: "var(--stage-surface)",
          border: isMobile ? "none" : "1px solid var(--stage-border)",
          boxShadow: isMobile ? "none" : "0 25px 50px var(--stage-overlay)",
          borderRadius: isMobile ? 0 : 12,
          maxWidth: isMobile ? "100%" : "42rem",
          maxHeight: isMobile ? "100%" : "90vh",
          height: isMobile ? "100%" : "auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid var(--stage-border)", padding: isMobile ? "12px" : "16px 24px" }}
        >
          <h2
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: isMobile ? 22 : 36,
              fontWeight: 600,
            }}
          >
            {isEditing ? "Edit Cue" : "New Cue"}
          </h2>
          <button
            onClick={closeCueEditor}
            className="px-3 py-2 rounded hover:bg-white/5"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 24, color: "var(--stage-muted)" }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="py-5 space-y-4 flex-1 overflow-y-auto" style={{ padding: isMobile ? "16px 12px" : "20px 24px" }}>
          {error && (
            <div
              className="px-3 py-2 rounded text-sm"
              style={{
                background: "rgba(232, 120, 71, 0.1)",
                border: "1px solid rgba(232, 120, 71, 0.3)",
                color: "var(--stage-danger)",
                fontFamily: "DM Mono, monospace",
                fontSize: 24,
              }}
            >
              {error}
            </div>
          )}

          {/* Script reference (editable) */}
          {(scriptRef || lineText) && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: isMobile ? 10 : 20,
                    color: "var(--stage-muted)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Highlighted Text
                </label>
                {scriptRef && (
                  <button
                    onClick={() => setScriptRef("")}
                    className="px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 10,
                      color: "var(--stage-muted)",
                      border: "1px solid var(--stage-border-subtle)",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Show full line text for context with selectable highlight */}
              {lineText && (
                <div className="mb-2">
                  <div
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 9,
                      color: "var(--stage-faint)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Full line (select text to update highlight)
                  </div>
                  <div
                    className="px-3 py-2 rounded"
                    style={{
                      fontFamily: "Libre Baskerville, serif",
                      fontSize: isMobile ? 14 : 16,
                      lineHeight: 1.6,
                      color: "#a09888",
                      background: "var(--stage-line-hover)",
                      border: "1px solid var(--stage-border)",
                      whiteSpace: "pre-wrap",
                      cursor: "text",
                      userSelect: "text",
                    }}
                    onMouseUp={() => {
                      const sel = window.getSelection();
                      if (sel && !sel.isCollapsed) {
                        const selected = sel.toString().trim();
                        if (selected && lineText.includes(selected)) {
                          setScriptRef(selected);
                        }
                      }
                    }}
                  >
                    {scriptRef && lineText.includes(scriptRef) ? (
                      (() => {
                        const idx = lineText.indexOf(scriptRef);
                        return (
                          <>
                            {lineText.slice(0, idx)}
                            <span style={{
                              background: `${CUE_TYPES[type]?.color || "var(--stage-gold)"}20`,
                              borderBottom: `2px solid ${CUE_TYPES[type]?.color || "var(--stage-gold)"}`,
                              color: CUE_TYPES[type]?.color || "var(--stage-gold)",
                              borderRadius: 2,
                              padding: "1px 0",
                            }}>
                              {scriptRef}
                            </span>
                            {lineText.slice(idx + scriptRef.length)}
                          </>
                        );
                      })()
                    ) : (
                      lineText
                    )}
                  </div>
                </div>
              )}

              {/* Direct edit field for the highlight text */}
              <textarea
                value={scriptRef}
                onChange={(e) => setScriptRef(e.target.value)}
                rows={2}
                placeholder="Type or select text from the line above"
                className="w-full px-3 py-2 rounded resize-none"
                style={{
                  fontFamily: "Libre Baskerville, serif",
                  fontSize: isMobile ? 14 : 16,
                  lineHeight: 1.6,
                  background: "rgba(232, 197, 71, 0.04)",
                  border: "1px solid rgba(232, 197, 71, 0.15)",
                  borderLeft: `3px solid ${CUE_TYPES[type]?.color || "var(--stage-gold)"}80`,
                  color: "var(--stage-text)",
                  outline: "none",
                }}
              />
            </div>
          )}

          {/* Type selector */}
          <div>
            <label
              className="block mb-1.5"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 20,
                color: "var(--stage-muted)",
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
                  onClick={() => {
                    setType(ct.type);
                    if (!isEditing) {
                      const nextNum = getNextNumber(ct.type);
                      setNumber(nextNum);
                    }
                  }}
                  className="px-3 py-1.5 rounded transition-all"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 22,
                    fontWeight: type === ct.type ? 700 : 400,
                    color: type === ct.type ? ct.color : "var(--stage-dim)",
                    background:
                      type === ct.type ? ct.color + "15" : "transparent",
                    border: `1px solid ${
                      type === ct.type ? ct.color + "40" : "var(--stage-border-subtle)"
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
                  color: "var(--stage-muted)",
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
                  fontSize: 26,
                  background: "var(--stage-bg)",
                  border: "1px solid var(--stage-border)",
                  color: "var(--stage-text)",
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
                  color: "var(--stage-muted)",
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
                  fontSize: 26,
                  background: "var(--stage-bg)",
                  border: "1px solid var(--stage-border)",
                  color: "var(--stage-text)",
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
                fontSize: 20,
                color: "var(--stage-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {type === "SET" ? "Notes" : type === "PROPS" ? "Notes" : "Cue Note"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={type === "SET" ? "Set design notes" : type === "PROPS" ? "Prop notes" : "Describe the cue execution..."}
              className="w-full px-3 py-2 rounded resize-none"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 24,
                lineHeight: 1.6,
                background: "var(--stage-bg)",
                border: "1px solid var(--stage-border)",
                color: "var(--stage-text)",
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
                  color: "var(--stage-muted)",
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
                  fontSize: 26,
                  background: "var(--stage-bg)",
                  border: "1px solid var(--stage-border)",
                  color: "var(--stage-text)",
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
                  color: "var(--stage-muted)",
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
                  fontSize: 26,
                  background: "var(--stage-bg)",
                  border: "1px solid var(--stage-border)",
                  color: "var(--stage-text)",
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
                fontSize: 20,
                color: "var(--stage-muted)",
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
                    DRAFT: "var(--stage-danger)",
                    REVIEW: "var(--stage-gold)",
                    APPROVED: "var(--stage-success)",
                    LOCKED: "var(--stage-muted)",
                  };
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className="px-3 py-1.5 rounded transition-all"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 20,
                        fontWeight: status === s ? 700 : 400,
                        color: status === s ? colors[s] : "var(--stage-dim)",
                        background:
                          status === s ? colors[s] + "15" : "transparent",
                        border: `1px solid ${
                          status === s ? colors[s] + "40" : "var(--stage-border-subtle)"
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
          className="flex items-center justify-between flex-shrink-0"
          style={{ borderTop: "1px solid var(--stage-border)", padding: isMobile ? "12px" : "16px 24px" }}
        >
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded transition-colors hover:bg-red-500/10"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 22,
                  color: "var(--stage-danger)",
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
                fontSize: 24,
                color: "var(--stage-muted)",
                border: "1px solid var(--stage-border-subtle)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !label}
              className="px-4 py-2 rounded transition-colors"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 24,
                fontWeight: 600,
                color: "var(--stage-gold)",
                background: "#E8C54715",
                border: "1px solid #E8C54740",
                opacity: saving || !label ? 0.5 : 1,
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
