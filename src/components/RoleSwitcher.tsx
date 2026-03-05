"use client";

import { useStageStore } from "@/lib/store";
import { ROLES, ROLE_LIST } from "@/lib/roles";
import { CUE_TYPES } from "@/lib/cue-types";
import type { ProjectRole } from "@/types";

interface RoleSwitcherProps {
  myRole: ProjectRole;
}

export function RoleSwitcher({ myRole }: RoleSwitcherProps) {
  const { activeRole, setActiveRole } = useStageStore();
  const activeConfig = ROLES[activeRole];

  return (
    <div className="flex-shrink-0">
      {/* Role tabs */}
      <div
        className="flex items-center gap-1 px-5 py-2 overflow-x-auto"
        style={{
          background: "#16150f",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <span
          className="mr-2 flex-shrink-0"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 9,
            color: "#555",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          View as:
        </span>

        {ROLE_LIST.map((role) => {
          const isActive = activeRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all whitespace-nowrap flex-shrink-0"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 11,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? role.color : "#777",
                background: isActive ? role.color + "12" : "transparent",
                border: isActive
                  ? `1px solid ${role.color}40`
                  : "1px solid transparent",
              }}
            >
              <span style={{ fontSize: 13 }}>{role.icon}</span>
              {role.label}
              {role.id === myRole && (
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
        className="flex items-center gap-3 px-5 py-1.5"
        style={{
          background: "#13120f",
          borderBottom: "1px solid rgba(255,255,255,0.02)",
        }}
      >
        <span
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 9,
            color: "#444",
            letterSpacing: "0.08em",
          }}
        >
          SHOWING:
        </span>

        {activeConfig.visibleCueTypes.map((type) => {
          const config = CUE_TYPES[type];
          if (!config) return null;
          return (
            <span
              key={type}
              className="flex items-center gap-1"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 10,
                color: config.color,
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{
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
              fontSize: 10,
              color: "#444",
            }}
          >
            Script only (no cues)
          </span>
        )}
      </div>
    </div>
  );
}
