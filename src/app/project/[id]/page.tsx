"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useStageStore } from "@/lib/store";
import { useYjs } from "@/hooks/useYjs";
import { Header } from "@/components/Header";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { ScriptView } from "@/components/ScriptView";
import { CueSidePanel } from "@/components/CueSidePanel";
import { CueEditor } from "@/components/CueEditor";
import { ROLES } from "@/lib/roles";
import type { ProjectRole } from "@/types";

interface PageProps {
  params: { id: string };
}

export default function ProjectPage({ params }: PageProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<ProjectRole>("STAGE_MANAGER");

  const {
    activeRole,
    setProject,
    isCuePanelOpen,
    isCueEditorOpen,
    setOnlineUsers,
  } = useStageStore();

  // Real-time collaboration
  const yjs = useYjs({
    projectId: params.id,
    userId: (session?.user as any)?.id || "anonymous",
    userName: session?.user?.name || "Anonymous",
    userRole: myRole,
  });

  // Sync presence to store
  useEffect(() => {
    setOnlineUsers(
      yjs.onlineUsers.map((u) => ({
        userId: u.userId,
        name: u.name,
        color: u.color,
        role: u.role,
      }))
    );
  }, [yjs.onlineUsers, setOnlineUsers]);

  // Fetch project data
  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load project");
        return r.json();
      })
      .then((data) => {
        setProject({
          id: data.id,
          title: data.title,
          scenes: data.scenes,
          members: data.members,
        });
        setMyRole(data.myRole);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [params.id, setProject]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div
            className="text-3xl mb-3 animate-pulse-dot"
            style={{ color: "#E8C547" }}
          >
            ◆
          </div>
          <p
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              color: "#666",
            }}
          >
            Loading production...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p style={{ color: "#E87847", fontFamily: "DM Mono, monospace" }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  const roleConfig = ROLES[activeRole];
  const showSidePanel = roleConfig.hasCuePanel && isCuePanelOpen;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top header with title, connection status, collaborators */}
      <Header
        connected={yjs.connected}
        synced={yjs.synced}
      />

      {/* Role switcher tabs */}
      <RoleSwitcher myRole={myRole} />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Script panel */}
        <ScriptView />

        {/* Cue side panel (for operator roles) */}
        {showSidePanel && <CueSidePanel />}
      </div>

      {/* Cue editor modal */}
      {isCueEditorOpen && <CueEditor projectId={params.id} />}

      {/* Footer status bar */}
      <div
        className="flex items-center justify-between px-5 py-1.5 flex-shrink-0"
        style={{
          background: "#1a1916",
          borderTop: "1px solid rgba(255,255,255,0.03)",
          fontFamily: "DM Mono, monospace",
          fontSize: 10,
        }}
      >
        <div className="flex gap-4" style={{ color: "#555" }}>
          <span>
            {roleConfig.icon} {roleConfig.label} View
          </span>
          <span>
            {yjs.connected ? (
              <span style={{ color: "#47E86A" }}>● Connected</span>
            ) : (
              <span style={{ color: "#E87847" }}>● Disconnected</span>
            )}
          </span>
        </div>
        <div style={{ color: "#444" }}>
          {yjs.onlineUsers.length} collaborator
          {yjs.onlineUsers.length !== 1 ? "s" : ""} online
        </div>
      </div>
    </div>
  );
}
