"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useStageStore } from "@/lib/store";
import { useYjs } from "@/hooks/useYjs";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Header } from "@/components/Header";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { ScriptView } from "@/components/ScriptView";
import { CueSidePanel } from "@/components/CueSidePanel";
import { WriterSidePanel } from "@/components/WriterSidePanel";
import { CueEditor } from "@/components/CueEditor";
import { Settings } from "@/components/Settings";
import { ROLES } from "@/lib/roles";
import type { ProjectRole } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectPage({ params: paramsPromise }: PageProps) {
  const params = use(paramsPromise);
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myRoles, setMyRoles] = useState<ProjectRole[]>(["STAGE_MANAGER"]);

  const {
    activeRole,
    setProject,
    isCuePanelOpen,
    toggleCuePanel,
    isCueEditorOpen,
    isSettingsOpen,
    cuePanelSide,
    setOnlineUsers,
    setRemoteCursors,
  } = useStageStore();

  const isMobile = useIsMobile();

  // Real-time collaboration
  const yjs = useYjs({
    projectId: params.id,
    userId: (session?.user as any)?.id || "anonymous",
    userName: session?.user?.name || "Anonymous",
    userRole: myRoles[0],
  });

  // Real-time document sync
  const { broadcast } = useRealtimeSync(yjs.doc, (session?.user as any)?.id || "anonymous");

  // Sync presence and remote cursors to store
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

  useEffect(() => {
    setRemoteCursors(yjs.remoteCursors);
  }, [yjs.remoteCursors, setRemoteCursors]);

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
          customRoles: data.customRoles || [],
          customCueTypes: data.customCueTypes || [],
        });
        setMyRoles(data.myRoles || [data.myRole] || ["VIEWER"]);
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
            style={{ color: "var(--stage-gold)" }}
          >
            ◆
          </div>
          <p
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              color: "var(--stage-dim)",
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
          <p style={{ color: "var(--stage-danger)", fontFamily: "DM Mono, monospace" }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  const roleConfig = ROLES[activeRole];
  const showSidePanel = roleConfig.hasCuePanel && isCuePanelOpen;
  const isWriter = activeRole === "WRITER";
  const SidePanel = isWriter ? WriterSidePanel : CueSidePanel;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top header with title, connection status, collaborators */}
      <Header
        connected={yjs.connected}
        synced={yjs.synced}
      />

      {/* Role switcher tabs */}
      <RoleSwitcher myRoles={myRoles} />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Cue side panel on left (desktop only for side layout) */}
        {showSidePanel && cuePanelSide === "left" && !isMobile && <SidePanel />}

        {/* Script panel */}
        <ScriptView broadcast={broadcast} projectId={params.id} updateCursor={yjs.updateCursor} yDoc={yjs.doc} synced={yjs.synced} />

        {/* Cue side panel on right (desktop only for side layout) */}
        {showSidePanel && cuePanelSide === "right" && !isMobile && <SidePanel />}
      </div>

      {/* Mobile: Cue panel overlay */}
      {isMobile && showSidePanel && <SidePanel />}

      {/* Floating cue panel toggle (shown when panel is closed) */}
      {roleConfig.hasCuePanel && !showSidePanel && (
        <button
          onClick={toggleCuePanel}
          style={{
            position: "fixed",
            bottom: isMobile ? 20 : 24,
            right: isMobile ? 16 : 24,
            zIndex: 30,
            height: isMobile ? 48 : 40,
            borderRadius: isMobile ? "50%" : 8,
            background: roleConfig.color + "20",
            border: `2px solid ${roleConfig.color}60`,
            color: roleConfig.color,
            fontFamily: "DM Mono, monospace",
            fontSize: isMobile ? 11 : 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px var(--stage-overlay)",
            padding: isMobile ? undefined : "0 14px",
            width: isMobile ? 48 : "auto",
            gap: 6,
          }}
          title={isWriter ? "Open Characters & Settings" : "Open " + (activeRole === "PROPS" ? "Props List" : "Cue Sheet")}
        >
          {roleConfig.icon} {isMobile
            ? (isWriter ? "EDIT" : activeRole === "PROPS" ? "PROPS" : "CUE")
            : (isWriter ? "Characters & Settings" : activeRole === "PROPS" ? "Props List" : "Cue Sheet")}
        </button>
      )}

      {/* Cue editor modal */}
      {isCueEditorOpen && <CueEditor projectId={params.id} broadcast={broadcast} />}

      {/* Settings modal */}
      {isSettingsOpen && <Settings projectId={params.id} myRoles={myRoles} />}

      {/* Footer status bar (hidden on mobile) */}
      {!isMobile && (
        <div
          className="flex items-center justify-between px-5 py-1.5 flex-shrink-0"
          style={{
            background: "var(--stage-surface)",
            borderTop: "1px solid var(--stage-hover)",
            fontFamily: "DM Mono, monospace",
            fontSize: 10,
          }}
        >
          <div className="flex gap-4" style={{ color: "var(--stage-faint)" }}>
            <span>
              {roleConfig.icon} {roleConfig.label} View
            </span>
            <span>
              {yjs.connected ? (
                <span style={{ color: "var(--stage-success)" }}>● Connected</span>
              ) : (
                <span style={{ color: "var(--stage-danger)" }}>● Disconnected</span>
              )}
            </span>
          </div>
          <div style={{ color: "var(--stage-ultra-faint)" }}>
            {yjs.onlineUsers.length} collaborator
            {yjs.onlineUsers.length !== 1 ? "s" : ""} online
          </div>
        </div>
      )}
    </div>
  );
}
