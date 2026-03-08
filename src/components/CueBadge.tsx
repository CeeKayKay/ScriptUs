"use client";

import { useMemo } from "react";
import { useStageStore } from "@/lib/store";
import { CUE_TYPES, getEffectiveCueTypes, getCurrentTheme } from "@/lib/cue-types";
import type { CueView } from "@/types";

interface CueBadgeProps {
  cue: CueView;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}

export function CueBadge({ cue, isActive, onClick, compact }: CueBadgeProps) {
  const overrides = useStageStore((s) => s.cueTypeColorOverrides);
  const overridesLight = useStageStore((s) => s.cueTypeColorOverridesLight);
  const effCueTypes = useMemo(() => {
    const t = getCurrentTheme();
    return getEffectiveCueTypes(t === "light" ? overridesLight : overrides);
  }, [overrides, overridesLight]);
  const config = effCueTypes[cue.type] || CUE_TYPES[cue.type];
  if (!config) return null;

  const statusDot =
    cue.status === "DRAFT"
      ? "#E87847"
      : cue.status === "REVIEW"
      ? "#E8C547"
      : cue.status === "APPROVED"
      ? "#47E86A"
      : "#888";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="cue-badge inline-flex items-center gap-1 rounded whitespace-nowrap"
      style={{
        padding: compact ? "1px 5px" : "2px 7px",
        border: `1px solid ${isActive ? config.color : config.borderColor}`,
        background: isActive ? config.color + "25" : config.bgColor,
        color: config.color,
        fontSize: compact ? 9 : 11,
        fontFamily: "DM Mono, monospace",
        fontWeight: 600,
        letterSpacing: "0.03em",
        cursor: "pointer",
        boxShadow: isActive ? `0 0 12px ${config.color}25` : "none",
      }}
    >
      <span style={{ fontSize: compact ? 7 : 8, opacity: 0.6 }}>
        {config.label}
      </span>
      {cue.label}
      <span
        className="inline-block w-1.5 h-1.5 rounded-full ml-0.5"
        style={{ background: statusDot }}
        title={cue.status}
      />
    </button>
  );
}
