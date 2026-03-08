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
import { CommentSidePanel } from "@/components/CommentSidePanel";
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
    isCueEditorOpen,
    isSettingsOpen,
    isCommentPanelOpen,
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
          cueTypeColors: data.cueTypeColors || null,
          cueTypeColorsLight: data.cueTypeColorsLight || null,
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
        {/* Cue side panel on left */}
        {showSidePanel && cuePanelSide === "left" && !isMobile && <SidePanel />}

        {/* Comment panel on left (when cue panel is on right) */}
        {isCommentPanelOpen && cuePanelSide === "right" && !isMobile && <CommentSidePanel projectId={params.id} />}

        {/* Script panel */}
        <ScriptView broadcast={broadcast} projectId={params.id} updateCursor={yjs.updateCursor} yDoc={yjs.doc} synced={yjs.synced} />

        {/* Cue side panel on right */}
        {showSidePanel && cuePanelSide === "right" && !isMobile && <SidePanel />}

        {/* Comment panel on right (when cue panel is on left) */}
        {isCommentPanelOpen && cuePanelSide === "left" && !isMobile && <CommentSidePanel projectId={params.id} />}
      </div>

      {/* Mobile: Cue panel overlay */}
      {isMobile && showSidePanel && <SidePanel />}

      {/* Mobile: Comment panel overlay */}
      {isMobile && isCommentPanelOpen && <CommentSidePanel projectId={params.id} />}

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
