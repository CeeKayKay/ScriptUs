"use client";

import { forwardRef } from "react";
import { CueBadge } from "./CueBadge";
import { CUE_TYPES } from "@/lib/cue-types";
import type { ScriptLineView, CueType, CueView } from "@/types";

interface ScriptLineProps {
  line: ScriptLineView;
  visibleCueTypes: CueType[];
  activeCueId: string | null;
  onCueClick: (cue: CueView) => void;
  onAddCue?: (lineId: string) => void;
  showAddButton?: boolean;
}

export const ScriptLine = forwardRef<HTMLDivElement, ScriptLineProps>(
  function ScriptLine(
    { line, visibleCueTypes, activeCueId, onCueClick, onAddCue, showAddButton },
    ref
  ) {
    const relevantCues = line.cues.filter((c) =>
      visibleCueTypes.includes(c.type)
    );
    const hasActiveCue = relevantCues.some((c) => c.id === activeCueId);
    const activeCue = relevantCues.find((c) => c.id === activeCueId);
    const activeCueConfig = activeCue ? CUE_TYPES[activeCue.type] : null;

    // --- Act Header ---
    if (line.type === "ACT_HEADER") {
      return (
        <div
          ref={ref}
          data-line-id={line.id}
          className="pt-8 pb-4 text-center"
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "#E8C547",
            borderBottom: "1px solid rgba(232, 197, 71, 0.18)",
            marginBottom: 16,
          }}
        >
          {line.text}
        </div>
      );
    }

    // --- Scene Header ---
    if (line.type === "SCENE_HEADER") {
      return (
        <div
          ref={ref}
          data-line-id={line.id}
          className="pt-6 pb-3"
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 18,
            fontWeight: 600,
            color: "#c8c0b0",
            letterSpacing: "0.08em",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 12,
          }}
        >
          {line.text}
        </div>
      );
    }

    // --- Stage Direction ---
    if (line.type === "STAGE_DIRECTION" || line.type === "TRANSITION") {
      return (
        <div
          ref={ref}
          data-line-id={line.id}
          className="script-line group"
          style={{
            padding: "8px 16px",
            margin: "5px 0",
            background: hasActiveCue ? "rgba(255,255,255,0.03)" : undefined,
            borderLeft: hasActiveCue
              ? `2px solid ${activeCueConfig?.color || "#555"}`
              : "2px solid transparent",
            borderRadius: 4,
            transition: "all 0.3s ease",
          }}
        >
          <div
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 13,
              color: "#8a8070",
              fontStyle: "italic",
              lineHeight: 1.7,
            }}
          >
            [{line.text}]
          </div>

          {(relevantCues.length > 0 || showAddButton) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {relevantCues.map((cue) => (
                <CueBadge
                  key={cue.id}
                  cue={cue}
                  isActive={cue.id === activeCueId}
                  onClick={() => onCueClick(cue)}
                />
              ))}
              {showAddButton && (
                <button
                  onClick={() => onAddCue?.(line.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    color: "#555",
                    border: "1px dashed #333",
                  }}
                >
                  + cue
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    // --- Dialogue ---
    if (line.type === "DIALOGUE" || line.type === "SONG") {
      return (
        <div
          ref={ref}
          data-line-id={line.id}
          className="script-line group flex gap-4"
          style={{
            padding: "3px 0 3px 16px",
            margin: "2px 0",
            background: hasActiveCue ? "rgba(255,255,255,0.03)" : undefined,
            borderLeft: hasActiveCue
              ? `2px solid ${activeCueConfig?.color || "#555"}`
              : "2px solid transparent",
            borderRadius: 4,
            transition: "all 0.3s ease",
          }}
        >
          {/* Character name */}
          <div
            className="flex-shrink-0 text-right"
            style={{
              width: 110,
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              fontWeight: 700,
              color: "#E8C547",
              letterSpacing: "0.05em",
              paddingTop: 3,
            }}
          >
            {line.character}
          </div>

          {/* Dialogue text + cues */}
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontFamily: "Libre Baskerville, serif",
                fontSize: 14.5,
                color: "#e0ddd5",
                lineHeight: 1.75,
              }}
            >
              {line.text}
            </div>

            {(relevantCues.length > 0 || showAddButton) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {relevantCues.map((cue) => (
                  <CueBadge
                    key={cue.id}
                    cue={cue}
                    isActive={cue.id === activeCueId}
                    onClick={() => onCueClick(cue)}
                  />
                ))}
                {showAddButton && (
                  <button
                    onClick={() => onAddCue?.(line.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[10px]"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      color: "#555",
                      border: "1px dashed #333",
                    }}
                  >
                    + cue
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  }
);
