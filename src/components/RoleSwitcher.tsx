"use client";

import { useStageStore } from "@/lib/store";
import { ROLES, ROLE_LIST } from "@/lib/roles";
import { CUE_TYPES } from "@/lib/cue-types";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ProjectRole } from "@/types";

interface RoleSwitcherProps {
  myRoles: ProjectRole[];
}

export function RoleSwitcher({ myRoles }: RoleSwitcherProps) {
  const { activeRole, setActiveRole } = useStageStore();
  const activeConfig = ROLES[activeRole];
  const isMobile = useIsMobile();

  return (
    <div className="flex-shrink-0">
      {/* Role tabs */}
      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{
          background: "#16150f",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
          padding: isMobile ? "6px 8px" : "8px 20px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {!isMobile && (
          <span
            className="mr-2 flex-shrink-0"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 18,
              color: "#555",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            View as:
          </span>
        )}

        {ROLE_LIST.map((role) => {
          const isActive = activeRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className="flex items-center gap-1.5 rounded-md transition-all whitespace-nowrap flex-shrink-0"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: isMobile ? 12 : 22,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? role.color : "#777",
                background: isActive ? role.color + "12" : "transparent",
                border: isActive
                  ? `1px solid ${role.color}40`
                  : "1px solid transparent",
                padding: isMobile ? "6px 10px" : "8px 16px",
              }}
            >
              <span style={{ fontSize: isMobile ? 16 : 26 }}>{role.icon}</span>
              {!isMobile && role.label}
              {isMobile && isActive && (
                <span>{role.label}</span>
              )}
              {myRoles.includes(role.id) && (
                <span
                  className="text-[8px] px-1 py-0.5 rounded"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "#888",
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
          background: "#13120f",
          borderBottom: "1px solid rgba(255,255,255,0.02)",
          padding: isMobile ? "4px 8px" : "6px 20px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {!isMobile && (
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 18,
              color: "#444",
              letterSpacing: "0.08em",
            }}
          >
            SHOWING:
          </span>
        )}

        {activeConfig.visibleCueTypes.map((type) => {
          const config = CUE_TYPES[type];
          if (!config) return null;
          return (
            <span
              key={type}
              className="flex items-center gap-1 flex-shrink-0"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: isMobile ? 11 : 20,
                color: config.color,
              }}
            >
              <span
                className="inline-block rounded-sm"
                style={{
                  width: isMobile ? 10 : 14,
                  height: isMobile ? 10 : 14,
                  background: config.color + "40",
                  border: `1px solid ${config.color}`,
                }}
              />
              {config.label}
            </span>
          );
        })}

        {activeConfig.visibleCueTypes.length === 0 && (
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: isMobile ? 11 : 20,
              color: "#444",
            }}
          >
            Script only
          </span>
        )}
      </div>
    </div>
  );
}
