"use client";

import Link from "next/link";
import { useStageStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ProjectRole } from "@/types";

interface HeaderProps {
  connected: boolean;
  synced: boolean;
}

export function Header({ connected, synced }: HeaderProps) {
  const { projectTitle, onlineUsers, openSettings } = useStageStore();
  const isMobile = useIsMobile();

  return (
    <div
      className="relative flex items-center justify-between flex-shrink-0"
      style={{
        background: "var(--stage-surface)",
        borderBottom: "1px solid var(--stage-hover)",
        padding: isMobile ? "8px 12px" : "12px 20px",
      }}
    >
      {/* Left: Logo + back + connection */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="font-bold hover:opacity-80 transition-opacity"
          style={{
            fontFamily: "Playfair Display, serif",
            color: "var(--stage-gold)",
            letterSpacing: "0.05em",
            fontSize: isMobile ? 14 : 18,
          }}
          title="Back to Productions"
        >
          {isMobile ? "◆" : "◆ SCRIPTUS"}
        </Link>

        <Link
          href="/"
          className="rounded-md flex items-center justify-center hover:bg-white/5 transition-colors"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: isMobile ? 12 : 14,
            color: "var(--stage-dim)",
            border: "1px solid var(--stage-hover-strong)",
            padding: isMobile ? "4px 8px" : "4px 10px",
          }}
          title="Back to Productions"
        >
          ← Productions
        </Link>

        {/* Connection indicator */}
        <div
          className="flex items-center gap-1.5"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 10,
            color: connected ? "var(--stage-success)" : "var(--stage-danger)",
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-dot"
            style={{
              background: connected ? "var(--stage-success)" : "var(--stage-danger)",
            }}
          />
          {connected ? (synced ? "LIVE" : "SYNCING") : "OFFLINE"}
        </div>
      </div>

      {/* Center: Show title (hidden on mobile) */}
      {!isMobile && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 22,
              fontWeight: 600,
              color: "var(--stage-heading)",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            {projectTitle || "Untitled"}
          </span>
        </div>
      )}

      {/* Mobile: compact title */}
      {isMobile && projectTitle && (
        <span
          className="flex-1 text-center truncate mx-2"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--stage-heading)",
          }}
        >
          {projectTitle}
        </span>
      )}

      {/* Right: Settings + Online collaborators */}
      <div className="flex items-center gap-2">
        {/* Settings gear */}
        <button
          onClick={openSettings}
          className="rounded-md flex items-center justify-center hover:bg-white/5 transition-colors"
          style={{
            color: "var(--stage-muted)",
            fontSize: isMobile ? 20 : 24,
            border: "1px solid var(--stage-hover-strong)",
            width: isMobile ? 36 : 40,
            height: isMobile ? 36 : 40,
          }}
          title="Settings"
        >
          ⚙
        </button>

        {!isMobile && (
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 10,
              color: "var(--stage-faint)",
              marginRight: 4,
            }}
          >
            {onlineUsers.length} online
          </span>
        )}

        <div className="flex -space-x-1.5">
          {onlineUsers.slice(0, isMobile ? 3 : 6).map((user: { userId: string; name: string; color: string; role: ProjectRole }, i: number) => (
            <div
              key={`${user.userId}-${i}`}
              data-tooltip={`${user.name} (${user.role.replace("_", " ")})`}
              className="rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-[var(--stage-surface)]"
              style={{
                background: user.color + "25",
                border: `1.5px solid ${user.color}`,
                color: user.color,
                fontFamily: "DM Mono, monospace",
                width: isMobile ? 24 : 28,
                height: isMobile ? 24 : 28,
              }}
            >
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          ))}
          {onlineUsers.length > (isMobile ? 3 : 6) && (
            <div
              className="rounded-full flex items-center justify-center text-[9px] ring-2 ring-[var(--stage-surface)]"
              style={{
                background: "var(--stage-hover)",
                border: "1.5px solid var(--stage-ultra-faint)",
                color: "var(--stage-muted)",
                fontFamily: "DM Mono, monospace",
                width: isMobile ? 24 : 28,
                height: isMobile ? 24 : 28,
              }}
            >
              +{onlineUsers.length - (isMobile ? 3 : 6)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
