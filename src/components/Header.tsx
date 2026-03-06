"use client";

import Link from "next/link";
import { useStageStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/useIsMobile";

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
        background: "#1a1916",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        padding: isMobile ? "8px 12px" : "12px 20px",
      }}
    >
      {/* Left: Logo + connection */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="font-bold hover:opacity-80 transition-opacity"
          style={{
            fontFamily: "Playfair Display, serif",
            color: "#E8C547",
            letterSpacing: "0.05em",
            fontSize: isMobile ? 14 : 18,
          }}
        >
          {isMobile ? "◆" : "◆ SCRIPTUS"}
        </Link>

        {/* Connection indicator */}
        <div
          className="flex items-center gap-1.5"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 10,
            color: connected ? "#47E86A" : "#E87847",
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-dot"
            style={{
              background: connected ? "#47E86A" : "#E87847",
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
              fontFamily: "Playfair Display, serif",
              fontSize: 22,
              fontWeight: 600,
              color: "#c8c0b0",
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
            fontFamily: "Playfair Display, serif",
            fontSize: 14,
            fontWeight: 600,
            color: "#c8c0b0",
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
            color: "#888",
            fontSize: isMobile ? 20 : 24,
            border: "1px solid rgba(255,255,255,0.08)",
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
              color: "#555",
              marginRight: 4,
            }}
          >
            {onlineUsers.length} online
          </span>
        )}

        <div className="flex -space-x-1.5">
          {onlineUsers.slice(0, isMobile ? 3 : 6).map((user, i) => (
            <div
              key={`${user.userId}-${i}`}
              data-tooltip={`${user.name} (${user.role.replace("_", " ")})`}
              className="rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-[#1a1916]"
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
              className="rounded-full flex items-center justify-center text-[9px] ring-2 ring-[#1a1916]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1.5px solid #444",
                color: "#888",
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
