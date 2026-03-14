"use client";

import { useMemo, useState, useRef } from "react";
import { useStageStore } from "@/lib/store";
import { ROLES } from "@/lib/roles";
import { CUE_TYPES, getEffectiveCueTypes, getCurrentTheme } from "@/lib/cue-types";
import { useIsMobile } from "@/hooks/useIsMobile";
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
    cueTypeColorOverrides,
    cueTypeColorOverridesLight,
    hiddenCueTypes,
    customRoles,
    customCueTypes,
  } = useStageStore();

  // Get role config - check built-in roles first, then custom roles
  const roleConfig = ROLES[activeRole as keyof typeof ROLES] || (() => {
    const customRole = customRoles.find((r) => r.id === activeRole);
    if (customRole) {
      return {
        id: customRole.id,
        label: customRole.name,
        icon: customRole.icon,
        color: customRole.color,
        visibleCueTypes: customRole.visibleCueTypes,
        showAllDialogue: true,
        showStageDirections: true,
        hasCuePanel: true,
      };
    }
    return ROLES.STAGE_MANAGER; // fallback
  })();
  const isMobile = useIsMobile();
  const effCueTypes = useMemo(() => {
    const t = getCurrentTheme();
    const builtIn = getEffectiveCueTypes(t === "light" ? cueTypeColorOverridesLight : cueTypeColorOverrides);
    // Merge in custom cue types
    const merged: Record<string, { color: string; bgColor: string; borderColor: string; label?: string }> = { ...builtIn };
    customCueTypes.forEach((ct) => {
      merged[ct.type] = {
        color: ct.color,
        bgColor: ct.bgColor,
        borderColor: ct.borderColor,
        label: ct.label,
      };
    });
    return merged;
  }, [cueTypeColorOverrides, cueTypeColorOverridesLight, customCueTypes]);

  const [expandedCueId, setExpandedCueId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Collect all cues relevant to this role, ordered by cue number within each type
  const cues = useMemo(() => {
    const result: (CueView & { sceneName: string })[] = [];

    // For Stage Manager, filter out user-hidden cue types
    // Use string[] to allow custom cue types alongside built-in CueType
    let effectiveVisibleTypes: string[] = activeRole === "STAGE_MANAGER"
      ? roleConfig.visibleCueTypes.filter((t) => !hiddenCueTypes.has(t))
      : [...roleConfig.visibleCueTypes];

    // For custom roles, also include custom cue types associated with this role
    const customRole = customRoles.find((r) => r.id === activeRole);
    if (customRole) {
      // Find custom cue types associated with this role
      const associatedCueTypes = customCueTypes
        .filter((ct) => ct.associatedRole === customRole.id || ct.associatedRole === customRole.name)
        .map((ct) => ct.type);
      // Also check for cue type matching role name pattern
      const expectedTypeKey = customRole.name.toUpperCase().replace(/\s+/g, "_");
      if (!effectiveVisibleTypes.includes(expectedTypeKey)) {
        effectiveVisibleTypes.push(expectedTypeKey);
      }
      // Check for built-in type that closely matches (e.g., "PROJECTIONS" -> "PROJECTION")
      const builtInTypes = ["LIGHT", "SOUND", "PROPS", "SET", "BLOCKING", "PROJECTION", "FLY", "SPOT"];
      const matchingBuiltIn = builtInTypes.find(
        (bt) => expectedTypeKey.startsWith(bt) || bt.startsWith(expectedTypeKey.replace(/S$/, ""))
      );
      if (matchingBuiltIn && !effectiveVisibleTypes.includes(matchingBuiltIn)) {
        effectiveVisibleTypes.push(matchingBuiltIn);
      }
      // Add associated cue types
      associatedCueTypes.forEach((t) => {
        if (!effectiveVisibleTypes.includes(t)) {
          effectiveVisibleTypes.push(t);
        }
      });
    }

    scenes.forEach((scene) => {
      scene.lines.forEach((line) => {
        line.cues
          .filter((c) => effectiveVisibleTypes.includes(c.type))
          .forEach((cue) => {
            result.push({
              ...cue,
              sceneName: `Act ${scene.act}, Sc ${scene.scene}`,
            });
          });
      });
    });

    // Sort by type first (preserve visibleCueTypes order), then by cue number within each type
    const typeOrder = effectiveVisibleTypes;
    result.sort((a, b) => {
      const typeA = typeOrder.indexOf(a.type);
      const typeB = typeOrder.indexOf(b.type);
      if (typeA !== typeB) return typeA - typeB;
      return a.number - b.number;
    });

    return result;
  }, [scenes, roleConfig, activeRole, hiddenCueTypes, customRoles, customCueTypes]);

  const handleCueClick = (cue: CueView) => {
    setExpandedCueId(expandedCueId === cue.id ? null : cue.id);
    setActiveCueId(cue.id === activeCueId ? null : cue.id);

    // Scroll to the cue's scriptRef text or its line
    if (cue.scriptRef) {
      requestAnimationFrame(() => {
        // Find the cue badge rendered inline
        const badge = document.querySelector(`[data-cue-id="${cue.id}"]`);
        if (badge) {
          badge.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        // Fallback: search text nodes in the script
        const scriptContainer = document.querySelector(".flex-1.overflow-y-auto");
        if (!scriptContainer) return;
        const walker = document.createTreeWalker(scriptContainer, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          if (node.textContent && node.textContent.includes(cue.scriptRef!)) {
            (node.parentElement || node.parentNode as Element)?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
      });
    } else if (cue.lineId) {
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
      // Only show drop indicator on cues of the same type (or the end zone)
      if (cueId === "@@end") {
        setDragOverId(cueId);
      } else {
        const draggedCue = cues.find((c) => c.id === draggedId);
        const targetCue = cues.find((c) => c.id === cueId);
        if (draggedCue && targetCue && draggedCue.type === targetCue.type) {
          setDragOverId(cueId);
        }
      }
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

    const draggedCue = cues.find((c) => c.id === draggedId);
    if (!draggedCue) {
      setDraggedId(null);
      return;
    }

    // Filter to only cues of the same type for reordering
    const sameTypeCues = cues.filter((c) => c.type === draggedCue.type);
    const currentOrder = sameTypeCues.map((c) => c.id);
    const dragIdx = currentOrder.indexOf(draggedId);

    // targetId "@@end" means drop at the very end
    const dropIdx = targetId === "@@end"
      ? currentOrder.length - 1
      : currentOrder.indexOf(targetId);

    if (dragIdx === -1 || dropIdx === -1) {
      setDraggedId(null);
      return;
    }

    // Remove dragged from list and insert at drop position
    const newOrder = [...currentOrder];
    newOrder.splice(dragIdx, 1);
    const insertIdx = targetId === "@@end" ? newOrder.length : dropIdx;
    newOrder.splice(insertIdx, 0, draggedId);

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
        // Remove from store — try lineId first, then scan all lines in the scene
        if (cue.lineId && cue.sceneId) {
          removeCueFromLine(cue.sceneId, cue.lineId, cue.id);
        } else if (cue.sceneId) {
          // Cue might not have lineId — remove from any line in the scene
          const scene = scenes.find((s) => s.id === cue.sceneId);
          if (scene) {
            for (const line of scene.lines) {
              if (line.cues.some((c) => c.id === cue.id)) {
                removeCueFromLine(cue.sceneId, line.id, cue.id);
                break;
              }
            }
          }
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
      className="flex flex-col animate-slide-in"
      style={{
        ...(isMobile
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 40,
              width: "100%",
              background: "var(--stage-surface)",
            }
          : {
              flexShrink: 0,
              width: 320,
              background: "var(--stage-surface)",
              ...(cuePanelSide === "left"
                ? { borderRight: `1px solid ${roleConfig.color}15` }
                : { borderLeft: `1px solid ${roleConfig.color}15` }),
            }),
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-3.5 py-3 flex-shrink-0"
        style={{
          background: "var(--stage-viewas-bg)",
          borderBottom: `1px solid ${roleConfig.color}15`,
        }}
      >
        <div
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: Math.round(scriptTextSize * 0.75),
            fontWeight: 700,
            color: roleConfig.color,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {roleConfig.icon} {activeRole === "SET_DESIGN" ? "Set Design List" : activeRole === "SOUND" ? "Sound Cue Sheet" : activeRole === "LIGHTING" ? "Lighting Cue Sheet" : activeRole === "ACTOR" ? "Blocking Notes" : activeRole === "DIRECTOR" || activeRole === "STAGE_MANAGER" ? "Technical Cues" : activeRole === "PROPS" ? "Props List" : "Cue Sheet"}
        </div>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: Math.round(scriptTextSize * 0.6),
              color: "var(--stage-text)",
            }}
          >
            {cues.length} cues
          </span>
          <button
            onClick={toggleCuePanel}
            className="text-xs px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
            style={{
              fontFamily: "DM Mono, monospace",
              color: "var(--stage-faint)",
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
          const cueConfig = effCueTypes[cue.type] || CUE_TYPES[cue.type];
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
              ? "var(--stage-danger)"
              : cue.status === "REVIEW"
              ? "var(--stage-gold)"
              : cue.status === "APPROVED"
              ? "var(--stage-success)"
              : "var(--stage-muted)";

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
                    fontSize: Math.round(scriptTextSize * 0.85),
                    fontWeight: 700,
                    color: cueConfig.color,
                    letterSpacing: "0.03em",
                  }}
                >
                  {cue.label}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: Math.round(scriptTextSize * 0.55),
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
                    fontSize: Math.round(scriptTextSize * 0.75),
                    color: isVisible ? "#a09888" : "var(--stage-faint)",
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
                        fontSize: Math.round(scriptTextSize * 1.2),
                        color: "var(--stage-heading)",
                        lineHeight: 1.6,
                        background: "var(--stage-hover)",
                        border: "1px solid var(--stage-border)",
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
                          fontSize: Math.round(scriptTextSize * 0.9),
                          color: "var(--stage-dim)",
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
                          fontSize: Math.round(scriptTextSize * 1.1),
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
                        fontSize: Math.round(scriptTextSize * 1.0),
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
                      fontSize: Math.round(scriptTextSize * 1.0),
                      color: "var(--stage-ultra-faint)",
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
                          fontSize: Math.round(scriptTextSize * 1.0),
                          color: "var(--stage-danger)",
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
                          fontSize: Math.round(scriptTextSize * 0.9),
                          fontWeight: 700,
                          color: "var(--stage-danger)",
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
                          fontSize: Math.round(scriptTextSize * 0.9),
                          color: "var(--stage-muted)",
                          border: "1px solid var(--stage-border-subtle)",
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
                          fontSize: Math.round(scriptTextSize * 1.0),
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
                          fontSize: Math.round(scriptTextSize * 1.0),
                          color: "var(--stage-danger)",
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
                    fontSize: Math.round(scriptTextSize * 0.6),
                    color: "var(--stage-ultra-faint)",
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

        {/* Drop zone for dragging to the bottom of the list */}
        {draggedId && (
          <div
            onDragOver={(e) => handleDragOver(e, "@@end")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "@@end")}
            style={{
              minHeight: 48,
              borderTop: dragOverId === "@@end" ? `2px solid ${roleConfig.color}` : "2px solid transparent",
              transition: "border-color 0.15s ease",
            }}
          />
        )}

        {cues.length === 0 && (
          <div className="text-center py-12 px-4">
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: Math.round(scriptTextSize * 1.3),
                color: "var(--stage-text)",
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
