"use client";

import { useMemo } from "react";
import { useStageStore } from "@/lib/store";
import { ROLES, ROLE_LIST } from "@/lib/roles";
import { CUE_TYPES, getEffectiveCueTypes, getCurrentTheme } from "@/lib/cue-types";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ProjectRole } from "@/types";

interface RoleSwitcherProps {
  myRoles: ProjectRole[];
}

export function RoleSwitcher({ myRoles }: RoleSwitcherProps) {
  const { activeRole, setActiveRole, cueTypeColorOverrides, cueTypeColorOverridesLight, hiddenCueTypes, toggleCueTypeVisibility, customRoles, roleOrder } = useStageStore();
  const effCueTypes = useMemo(() => {
    const t = getCurrentTheme();
    return getEffectiveCueTypes(t === "light" ? cueTypeColorOverridesLight : cueTypeColorOverrides);
  }, [cueTypeColorOverrides, cueTypeColorOverridesLight]);
  const isMobile = useIsMobile();

  // Combine built-in roles with custom roles, sorted by roleOrder
  const allRoles = useMemo(() => {
    const builtIn = ROLE_LIST.map((r) => ({
      id: r.id,
      label: r.label,
      icon: r.icon,
      color: r.color,
      visibleCueTypes: r.visibleCueTypes,
      isCustom: false,
    }));
    const custom = customRoles.map((r) => ({
      id: r.id,
      label: r.name,
      icon: r.icon,
      color: r.color,
      visibleCueTypes: r.visibleCueTypes,
      isCustom: true,
    }));
    const combined = [...builtIn, ...custom];

    // Sort by roleOrder if set
    if (roleOrder.length === 0) return combined;
    const orderMap = new Map(roleOrder.map((id, idx) => [id, idx]));
    return [...combined].sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? Infinity;
      const bIdx = orderMap.get(b.id) ?? Infinity;
      if (aIdx === Infinity && bIdx === Infinity) {
        // Both not in order, keep original order
        return combined.indexOf(a) - combined.indexOf(b);
      }
      return aIdx - bIdx;
    });
  }, [customRoles, roleOrder]);

  // Get active role config (from built-in or custom)
  const activeConfig = useMemo(() => {
    if (ROLES[activeRole as ProjectRole]) {
      return ROLES[activeRole as ProjectRole];
    }
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
  }, [activeRole, customRoles]);

  // Stage Manager can toggle cue type visibility
  const canToggleCueTypes = activeRole === "STAGE_MANAGER";

  return (
    <div className="flex-shrink-0">
      {/* Role tabs */}
      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{
          background: "var(--stage-viewas-bg)",
          borderBottom: "1px solid var(--stage-hover)",
          padding: isMobile ? "6px 8px" : "8px 20px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {!isMobile && (
          <span
            className="mr-2 flex-shrink-0"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              color: "var(--stage-viewas-label)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            View as:
          </span>
        )}

        {allRoles.map((role) => {
          const isActive = activeRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className="flex items-center gap-1 rounded-md transition-all whitespace-nowrap flex-shrink-0"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: isMobile ? 10 : 13,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? role.color : "#ffffff",
                background: isActive ? role.color + "12" : "transparent",
                border: isActive
                  ? `1px solid ${role.color}40`
                  : "1px solid transparent",
                padding: isMobile ? "4px 6px" : "5px 10px",
              }}
            >
              <span style={{ fontSize: isMobile ? 14 : 16 }}>{role.icon}</span>
              {!isMobile && role.label}
              {isMobile && isActive && (
                <span>{role.label}</span>
              )}
              {myRoles.includes(role.id as ProjectRole) && (
                <span
                  className="text-[7px] px-1 py-0.5 rounded"
                  style={{
                    background: "var(--stage-hover-strong)",
                    color: "var(--stage-muted)",
                  }}
                >
                  YOU
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active cue types legend */}
      <div
        className="flex items-center gap-2 overflow-x-auto"
        style={{
          background: "var(--stage-bg)",
          borderBottom: "1px solid var(--stage-line-hover)",
          padding: isMobile ? "4px 8px" : "6px 20px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {!isMobile && (
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 11,
              color: "var(--stage-showing-label)",
              letterSpacing: "0.08em",
            }}
          >
            SHOWING:
          </span>
        )}

        {activeConfig.visibleCueTypes.map((type) => {
          const config = effCueTypes[type] || CUE_TYPES[type];
          if (!config) return null;
          const isHidden = hiddenCueTypes.has(type);
          return (
            <button
              key={type}
              onClick={canToggleCueTypes ? () => toggleCueTypeVisibility(type) : undefined}
              className="flex items-center gap-1 flex-shrink-0 transition-opacity"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: isMobile ? 9 : 12,
                color: config.color,
                opacity: isHidden ? 0.3 : 1,
                cursor: canToggleCueTypes ? "pointer" : "default",
                background: "none",
                border: "none",
                padding: 0,
              }}
              title={canToggleCueTypes ? (isHidden ? `Show ${config.label} cues` : `Hide ${config.label} cues`) : undefined}
            >
              <span
                className="inline-block rounded-sm transition-all"
                style={{
                  width: isMobile ? 8 : 10,
                  height: isMobile ? 8 : 10,
                  background: isHidden ? "transparent" : config.color + "40",
                  border: `1px solid ${config.color}`,
                }}
              />
              {config.label}
            </button>
          );
        })}

        {activeConfig.visibleCueTypes.length === 0 && (
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: isMobile ? 9 : 12,
              color: "var(--stage-showing-label)",
            }}
          >
            Script Editing Mode
          </span>
        )}
      </div>
    </div>
  );
}
