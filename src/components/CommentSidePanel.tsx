"use client";

import { useMemo, useState } from "react";
import { useStageStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { CommentView } from "@/types";

interface CommentWithContext extends CommentView {
  sceneName: string;
}

export function CommentSidePanel({ projectId }: { projectId: string }) {
  const {
    scenes,
    toggleCommentPanel,
    cuePanelSide,
    scriptTextSize,
    resolveComment,
    removeComment,
    selectedCommentRef,
    setSelectedCommentRef,
  } = useStageStore();

  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [deleting, setDeleting] = useState<string | null>(null);

  const fs = (ratio: number) => Math.round(scriptTextSize * ratio);

  const comments = useMemo(() => {
    const result: CommentWithContext[] = [];
    scenes.forEach((scene) => {
      scene.lines.forEach((line) => {
        (line.comments || []).forEach((c) => {
          result.push({
            ...c,
            sceneName: `Act ${scene.act}, Sc ${scene.scene}`,
          });
        });
      });
    });
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [scenes]);

  const filtered = useMemo(
    () => comments.filter((c) => (filter === "open" ? !c.resolved : c.resolved)),
    [comments, filter]
  );

  const handleResolve = async (commentId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, resolved: true }),
      });
      if (res.ok) resolveComment(commentId);
    } catch {}
  };

  const handleDelete = async (commentId: string) => {
    setDeleting(commentId);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments?commentId=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) removeComment(commentId);
    } catch {}
    setDeleting(null);
  };

  const panelSide = cuePanelSide === "left" ? "right" : "left";

  return (
    <div
      className="flex flex-col animate-slide-in"
      style={{
        ...(isMobile
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "var(--stage-bg)",
            }
          : {
              width: 320,
              minWidth: 280,
              maxWidth: 380,
              ...(panelSide === "right"
                ? { borderLeft: "1px solid #47B8E815" }
                : { borderRight: "1px solid #47B8E815" }),
            }),
        background: "var(--stage-bg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: "var(--stage-viewas-bg)", borderBottom: "1px solid #47B8E815" }}
      >
        <div style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), fontWeight: 700, color: "#47B8E8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Comments
        </div>
        <button
          onClick={toggleCommentPanel}
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: fs(0.75),
            color: "var(--stage-muted)",
            background: "none",
            border: "1px solid var(--stage-border-subtle)",
            borderRadius: 4,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          {isMobile ? "Close" : "✕"}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex px-3 pt-2 gap-1" style={{ borderBottom: "1px solid var(--stage-hover)" }}>
        {(["open", "resolved"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              fontFamily: "DM Mono, monospace",
              fontWeight: filter === tab ? 700 : 400,
              fontSize: fs(0.7),
              color: filter === tab ? "#47B8E8" : "var(--stage-dim)",
              background: filter === tab ? "#47B8E810" : "transparent",
              border: "none",
              borderBottom: filter === tab ? "2px solid #47B8E8" : "2px solid transparent",
              padding: "6px 12px",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {tab} ({comments.filter((c) => (tab === "open" ? !c.resolved : c.resolved)).length})
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-3 py-2" style={{ WebkitOverflowScrolling: "touch" }}>
        {filtered.length === 0 && (
          <div
            className="text-center py-8"
            style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.65), color: "var(--stage-faint)" }}
          >
            No {filter} comments
          </div>
        )}

        {filtered.map((c) => {
          const isSelected = selectedCommentRef === c.scriptRef && !!c.scriptRef;
          return (
          <div
            key={c.id}
            className="group/comment mb-2 rounded-lg p-3 transition-colors hover:bg-white/3"
            style={{
              background: isSelected ? "#47B8E810" : "var(--stage-surface)",
              border: isSelected ? "1px solid #47B8E840" : "1px solid var(--stage-border-subtle)",
              borderLeft: isSelected ? "3px solid #47B8E8" : "3px solid #47B8E840",
              cursor: c.scriptRef ? "pointer" : "default",
            }}
            onClick={() => {
              if (c.scriptRef) {
                setSelectedCommentRef(isSelected ? null : c.scriptRef);
              }
            }}
          >
            {/* Author + meta */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), fontWeight: 700, color: "#47B8E8" }}>
                  {c.user.name}
                </span>
                {c.role && (
                  <span style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: fs(0.6),
                    color: "var(--stage-text)",
                    background: "var(--stage-hover)",
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}>
                    {c.role.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <span style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.6), color: "var(--stage-faint)" }}>
                {c.sceneName}
              </span>
            </div>

            {/* Script reference */}
            {c.scriptRef && (
              <div style={{
                fontFamily: "Libre Baskerville, serif",
                fontSize: fs(0.7),
                color: "var(--stage-text)",
                fontStyle: "italic",
                padding: "3px 8px",
                marginBottom: 4,
                background: "#47B8E808",
                borderLeft: "2px solid #47B8E830",
                borderRadius: 2,
                whiteSpace: "pre-wrap",
                maxHeight: 36,
                overflow: "hidden",
              }}>
                &ldquo;{c.scriptRef}&rdquo;
              </div>
            )}

            {/* Comment text */}
            <div style={{
              fontFamily: "DM Mono, monospace",
              fontSize: fs(0.8),
              color: "var(--stage-text)",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}>
              {c.text}
            </div>

            {/* Timestamp + actions */}
            <div className="flex items-center justify-between mt-2">
              <span style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.55), color: "var(--stage-faint)" }}>
                {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <div className="flex gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                {!c.resolved && (
                  <button
                    onClick={() => handleResolve(c.id)}
                    title="Resolve"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: fs(0.55),
                      color: "#7BE847",
                      background: "#7BE84710",
                      border: "1px solid #7BE84730",
                      borderRadius: 3,
                      padding: "1px 6px",
                      cursor: "pointer",
                    }}
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  title="Delete"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: fs(0.55),
                    color: "var(--stage-error)",
                    background: "rgba(232,71,71,0.08)",
                    border: "1px solid rgba(232,71,71,0.2)",
                    borderRadius: 3,
                    padding: "1px 6px",
                    cursor: "pointer",
                    opacity: deleting === c.id ? 0.5 : 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
