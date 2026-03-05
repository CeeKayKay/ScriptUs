"use client";

import { useMemo, useState, useRef } from "react";
import { useStageStore } from "@/lib/store";
import { ROLES } from "@/lib/roles";
import { CUE_TYPES } from "@/lib/cue-types";
import type { CueView } from "@/types";

export function CueSidePanel() {
  const {
    activeRole,
    scenes,
    activeCueId,
    setActiveCueId,
    visibleLineIds,
    toggleCuePanel,
    cuePanelSide,
    scriptTextSize,
    reorderCuesInStore,
    removeCueFromLine,
    openCueEditor,
  } = useStageStore();

  const roleConfig = ROLES[activeRole];

  const [expandedCueId, setExpandedCueId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Collect all cues relevant to this role, ordered by script position
  const cues = useMemo(() => {
    const result: (CueView & { sceneName: string })[] = [];

    scenes.forEach((scene) => {
      scene.lines.forEach((line) => {
        // For lines with multiple cues, sort by where the scriptRef appears in the line text
        const lineCues = line.cues
          .filter((c) => roleConfig.visibleCueTypes.includes(c.type))
          .sort((a, b) => {
            const posA = a.scriptRef ? line.text.indexOf(a.scriptRef) : -1;
            const posB = b.scriptRef ? line.text.indexOf(b.scriptRef) : -1;
            // Cues with scriptRef come first, ordered by position in text
            if (posA >= 0 && posB >= 0) return posA - posB;
            if (posA >= 0) return -1;
            if (posB >= 0) return 1;
            return a.number - b.number;
          });

        lineCues.forEach((cue) => {
          result.push({
            ...cue,
            sceneName: `Act ${scene.act}, Sc ${scene.scene}`,
          });
        });
      });
    });

    return result;
  }, [scenes, roleConfig]);

  const handleCueClick = (cue: CueView) => {
    setExpandedCueId(expandedCueId === cue.id ? null : cue.id);
    setActiveCueId(cue.id === activeCueId ? null : cue.id);

    // Scroll the script to the cue's line
    if (cue.lineId) {
      const el = document.querySelector(`[data-line-id="${cue.lineId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  // Drag and drop
  const handleDragStart = (e: React.DragEvent, cueId: string) => {
    setDraggedId(cueId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cueId);
  };

  const handleDragOver = (e: React.DragEvent, cueId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (cueId !== draggedId) {
      setDragOverId(cueId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    // Reorder: move dragged cue to the position of the target
    const currentOrder = cues.map((c) => c.id);
    const dragIdx = currentOrder.indexOf(draggedId);
    const dropIdx = currentOrder.indexOf(targetId);

    if (dragIdx === -1 || dropIdx === -1) {
      setDraggedId(null);
      return;
    }

    // Remove dragged from list and insert at drop position
    const newOrder = [...currentOrder];
    newOrder.splice(dragIdx, 1);
    newOrder.splice(dropIdx, 0, draggedId);

    // Determine the cue type (all cues in this panel share role-visible types)
    const draggedCue = cues.find((c) => c.id === draggedId);
    if (draggedCue) {
      // Update store immediately
      reorderCuesInStore(draggedCue.type, newOrder);

      // Persist to API
      try {
        const updates = newOrder.map((id, idx) => ({ id, number: idx + 1 }));
        await fetch("/api/cues/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cues: updates }),
        });
      } catch (err) {
        console.error("Failed to persist cue reorder", err);
      }
    }

    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Delete cue and renumber remaining cues of the same type
  const handleDelete = async (cue: CueView & { sceneName: string }) => {
    setDeleting(cue.id);
    try {
      const res = await fetch(`/api/cues?id=${cue.id}`, { method: "DELETE" });
      if (res.ok) {
        // Remove from store
        if (cue.lineId && cue.sceneId) {
          removeCueFromLine(cue.sceneId, cue.lineId, cue.id);
        }
        setExpandedCueId(null);
        setConfirmDeleteId(null);

        // Renumber remaining cues of the same type
        const remaining = cues
          .filter((c) => c.id !== cue.id && c.type === cue.type)
          .sort((a, b) => a.number - b.number);

        if (remaining.length > 0) {
          const newOrder = remaining.map((c) => c.id);
          reorderCuesInStore(cue.type, newOrder);

          // Persist renumber to API
          const updates = newOrder.map((id, idx) => ({ id, number: idx + 1 }));
          await fetch("/api/cues/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cues: updates }),
          });
        }
      }
    } catch (err) {
      console.error("Failed to delete cue", err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col animate-slide-in"
      style={{
        width: 320,
        background: "#1a1916",
        ...(cuePanelSide === "left"
          ? { borderRight: `1px solid ${roleConfig.color}15` }
          : { borderLeft: `1px solid ${roleConfig.color}15` }),
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-3.5 py-3 flex-shrink-0"
        style={{
          borderBottom: `1px solid ${roleConfig.color}15`,
        }}
      >
        <div
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: Math.round(scriptTextSize * 0.55),
            fontWeight: 700,
            color: roleConfig.color,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {roleConfig.icon} Cue Sheet
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: Math.round(scriptTextSize * 0.5),
              color: "#555",
            }}
          >
            {cues.length} cues
          </span>
          <button
            onClick={toggleCuePanel}
            className="text-xs px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
            style={{
              fontFamily: "DM Mono, monospace",
              color: "#555",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Cue list */}
      <div className="flex-1 overflow-y-auto">
        {cues.map((cue) => {
          const isVisible = cue.lineId
            ? visibleLineIds.has(cue.lineId)
            : false;
          const isActive = cue.id === activeCueId;
          const isExpanded = cue.id === expandedCueId;
          const cueConfig = CUE_TYPES[cue.type];
          const isDragOver = cue.id === dragOverId;

          const statusLabel =
            cue.status === "DRAFT"
              ? "DRAFT"
              : cue.status === "REVIEW"
              ? "IN REVIEW"
              : cue.status === "APPROVED"
              ? "APPROVED"
              : "LOCKED";

          const statusColor =
            cue.status === "DRAFT"
              ? "#E87847"
              : cue.status === "REVIEW"
              ? "#E8C547"
              : cue.status === "APPROVED"
              ? "#47E86A"
              : "#888";

          return (
            <div
              key={cue.id}
              draggable
              onDragStart={(e) => handleDragStart(e, cue.id)}
              onDragOver={(e) => handleDragOver(e, cue.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cue.id)}
              onDragEnd={handleDragEnd}
              onClick={() => handleCueClick(cue)}
              className="cue-panel-item block w-full text-left relative"
              style={{
                padding: "10px 14px",
                background: isActive
                  ? cueConfig.color + "12"
                  : isVisible
                  ? cueConfig.color + "06"
                  : "transparent",
                borderLeft: isVisible
                  ? `3px solid ${cueConfig.color}`
                  : "3px solid transparent",
                borderTop: isDragOver ? `2px solid ${cueConfig.color}` : "2px solid transparent",
                cursor: "grab",
                transition: "all 0.25s ease",
                opacity: draggedId === cue.id ? 0.4 : 1,
              }}
            >
              {/* Live indicator dot */}
              {isVisible && (
                <div
                  className="absolute top-2.5 right-3 w-1.5 h-1.5 rounded-full"
                  style={{
                    background: cueConfig.color,
                    boxShadow: `0 0 8px ${cueConfig.color}50`,
                    animation: "pulse-dot 2s ease-in-out infinite",
                  }}
                />
              )}

              {/* Cue label */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: Math.round(scriptTextSize * 0.65),
                    fontWeight: 700,
                    color: isVisible ? cueConfig.color : "#666",
                    letterSpacing: "0.03em",
                  }}
                >
                  {cue.label}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: Math.round(scriptTextSize * 0.45),
                    color: statusColor,
                    background: statusColor + "15",
                    border: `1px solid ${statusColor}30`,
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Collapsed: short note preview */}
              {!isExpanded && (
                <div
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: Math.round(scriptTextSize * 0.6),
                    color: isVisible ? "#a09888" : "#555",
                    lineHeight: 1.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cue.note || "No note"}
                </div>
              )}

              {/* Expanded view */}
              {isExpanded && (
                <div
                  className="mt-2"
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: "default" }}
                >
                  {/* Full note */}
                  {cue.note && (
                    <div
                      className="mb-2 px-2 py-1.5 rounded"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: Math.round(scriptTextSize * 0.6),
                        color: "#c8c0b0",
                        lineHeight: 1.6,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid #2a2720",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {cue.note}
                    </div>
                  )}

                  {/* Script reference (highlighted text when cue was created) */}
                  {cue.scriptRef && (
                    <div className="mb-2">
                      <div
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: Math.round(scriptTextSize * 0.45),
                          color: "#666",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        Script Reference
                      </div>
                      <div
                        className="px-2 py-1.5 rounded"
                        style={{
                          fontFamily: "Libre Baskerville, serif",
                          fontSize: Math.round(scriptTextSize * 0.55),
                          color: "#a09888",
                          lineHeight: 1.6,
                          background: "rgba(232, 197, 71, 0.04)",
                          borderLeft: `2px solid ${cueConfig.color}40`,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {cue.scriptRef}
                      </div>
                    </div>
                  )}

                  {/* Timing info */}
                  {(cue.duration || cue.preWait) && (
                    <div
                      className="mb-2"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: Math.round(scriptTextSize * 0.5),
                        color: "#777",
                      }}
                    >
                      {cue.duration ? `Duration: ${cue.duration}s` : ""}
                      {cue.duration && cue.preWait ? " | " : ""}
                      {cue.preWait ? `Pre-wait: ${cue.preWait}s` : ""}
                    </div>
                  )}

                  {/* Scene reference */}
                  <div
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: Math.round(scriptTextSize * 0.5),
                      color: "#444",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                    }}
                  >
                    {(cue as any).sceneName}
                  </div>

                  {/* Action buttons */}
                  {confirmDeleteId === cue.id ? (
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 rounded"
                      style={{
                        background: "rgba(232, 120, 71, 0.08)",
                        border: "1px solid rgba(232, 120, 71, 0.2)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: Math.round(scriptTextSize * 0.5),
                          color: "#E87847",
                        }}
                      >
                        Delete this cue?
                      </span>
                      <button
                        onClick={() => handleDelete(cue)}
                        disabled={deleting === cue.id}
                        className="px-2 py-0.5 rounded transition-colors hover:bg-red-500/20"
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: Math.round(scriptTextSize * 0.45),
                          fontWeight: 700,
                          color: "#E87847",
                          border: "1px solid rgba(232, 120, 71, 0.4)",
                        }}
                      >
                        {deleting === cue.id ? "..." : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 rounded transition-colors hover:bg-white/5"
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: Math.round(scriptTextSize * 0.45),
                          color: "#888",
                          border: "1px solid #333",
                        }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCueEditor(cue)}
                        className="px-2 py-1 rounded transition-colors hover:bg-white/10"
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: Math.round(scriptTextSize * 0.5),
                          color: cueConfig.color,
                          border: `1px solid ${cueConfig.color}40`,
                        }}
                      >
                        Edit Cue
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(cue.id)}
                        className="px-2 py-1 rounded transition-colors hover:bg-red-500/10"
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: Math.round(scriptTextSize * 0.5),
                          color: "#E87847",
                          border: "1px solid rgba(232, 120, 71, 0.3)",
                        }}
                      >
                        Delete Cue
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Scene reference (collapsed only) */}
              {!isExpanded && (
                <div
                  className="mt-1"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: Math.round(scriptTextSize * 0.5),
                    color: "#444",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {(cue as any).sceneName}
                </div>
              )}
            </div>
          );
        })}

        {cues.length === 0 && (
          <div className="text-center py-12 px-4">
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: Math.round(scriptTextSize * 0.55),
                color: "#555",
              }}
            >
              No cues assigned for this role yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
