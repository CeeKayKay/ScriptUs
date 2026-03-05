"use client";

import Link from "next/link";
import { useStageStore } from "@/lib/store";

interface HeaderProps {
  connected: boolean;
  synced: boolean;
}

export function Header({ connected, synced }: HeaderProps) {
  const { projectTitle, onlineUsers } = useStageStore();

  return (
    <div
      className="flex items-center justify-between px-5 py-3 flex-shrink-0"
      style={{
        background: "#1a1916",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-lg font-bold hover:opacity-80 transition-opacity"
          style={{
            fontFamily: "Playfair Display, serif",
            color: "#E8C547",
            letterSpacing: "0.05em",
          }}
        >
          ◆ SCRIPTUS
        </Link>

        <span
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            color: "#666",
            padding: "3px 8px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 4,
            letterSpacing: "0.03em",
          }}
        >
          {projectTitle || "Untitled"}
        </span>

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

      {/* Online collaborators */}
      <div className="flex items-center gap-2">
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

        <div className="flex -space-x-1.5">
          {onlineUsers.slice(0, 6).map((user) => (
            <div
              key={user.userId}
              data-tooltip={`${user.name} (${user.role.replace("_", " ")})`}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-[#1a1916]"
              style={{
                background: user.color + "25",
                border: `1.5px solid ${user.color}`,
                color: user.color,
                fontFamily: "DM Mono, monospace",
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
          {onlineUsers.length > 6 && (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] ring-2 ring-[#1a1916]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1.5px solid #444",
                color: "#888",
                fontFamily: "DM Mono, monospace",
              }}
            >
              +{onlineUsers.length - 6}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
