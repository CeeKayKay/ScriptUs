"use client";

import { useMemo } from "react";
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
  } = useStageStore();

  const roleConfig = ROLES[activeRole];

  // Collect all cues relevant to this role, in order
  const cues = useMemo(() => {
    const result: (CueView & { sceneName: string })[] = [];

    scenes.forEach((scene) => {
      scene.lines.forEach((line) => {
        line.cues
          .filter((c) => roleConfig.visibleCueTypes.includes(c.type))
          .forEach((cue) => {
            result.push({
              ...cue,
              sceneName: `Act ${scene.act}, Sc ${scene.scene}`,
            });
          });
      });
    });

    return result.sort((a, b) => a.number - b.number);
  }, [scenes, roleConfig]);

  const handleCueClick = (cue: CueView) => {
    setActiveCueId(cue.id === activeCueId ? null : cue.id);

    // Scroll the script to the cue's line
    if (cue.lineId) {
      const el = document.querySelector(`[data-line-id="${cue.lineId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col animate-slide-in"
      style={{
        width: 280,
        background: "#1a1916",
        borderLeft: `1px solid ${roleConfig.color}15`,
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
            fontSize: 11,
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
              fontSize: 10,
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
          const cueConfig = CUE_TYPES[cue.type];

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
            <button
              key={cue.id}
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
                cursor: "pointer",
                transition: "all 0.25s ease",
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
                    fontSize: 12,
                    fontWeight: 700,
                    color: isVisible ? cueConfig.color : "#666",
                    letterSpacing: "0.03em",
                  }}
                >
                  {cue.label}
                </span>
                <span
                  className="text-[8px] px-1 py-0.5 rounded"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    color: statusColor,
                    background: statusColor + "15",
                    border: `1px solid ${statusColor}30`,
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Cue note */}
              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 11,
                  color: isVisible ? "#a09888" : "#555",
                  lineHeight: 1.5,
                }}
              >
                {cue.note}
              </div>

              {/* Timing info */}
              {cue.duration && (
                <div
                  className="mt-1"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 9,
                    color: "#555",
                  }}
                >
                  Duration: {cue.duration}s
                  {cue.preWait ? ` | Pre-wait: ${cue.preWait}s` : ""}
                </div>
              )}

              {/* Scene reference */}
              <div
                className="mt-1"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 9,
                  color: "#444",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {(cue as any).sceneName}
              </div>
            </button>
          );
        })}

        {cues.length === 0 && (
          <div className="text-center py-12 px-4">
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 11,
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
