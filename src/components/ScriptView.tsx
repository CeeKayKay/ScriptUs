"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useStageStore } from "@/lib/store";
import { ROLES } from "@/lib/roles";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ScriptLine } from "./ScriptLine";
import type { CueView, ScriptLineView, CommentView, LineType } from "@/types";

const LINE_TYPE_OPTIONS: { value: LineType; label: string }[] = [
  { value: "DIALOGUE", label: "Dialogue" },
  { value: "STAGE_DIRECTION", label: "Stage Direction" },
  { value: "SONG", label: "Song" },
  { value: "TRANSITION", label: "Transition" },
];

interface ScriptViewProps {
  broadcast?: (msg: any) => void;
  projectId?: string;
}

export function ScriptView({ broadcast, projectId: projectIdProp }: ScriptViewProps) {
  const {
    activeRole,
    projectId: storeProjectId,
    scenes,
    activeCueId,
    setActiveCueId,
    setVisibleLineIds,
    openCueEditor,
    addScene,
    addLineToScene,
    updateSceneTitle,
    updateLine,
    deleteLine,
    deleteScene,
    scriptTextSize,
    addComment,
    resolveComment,
    removeComment,
  } = useStageStore();

  const projectId = projectIdProp || storeProjectId;

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const visibleLineIdsRef = useRef<Set<string>>(new Set());
  const roleConfig = ROLES[activeRole];
  const isMobile = useIsMobile();

  // --- Add scene state ---
  const [showAddScene, setShowAddScene] = useState(false);
  const [newAct, setNewAct] = useState("1");
  const [newSceneNum, setNewSceneNum] = useState("1");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [sceneSaving, setSceneSaving] = useState(false);

  // --- Add line state ---
  const [addingLineToScene, setAddingLineToScene] = useState<string | null>(null);
  const [newLineType, setNewLineType] = useState<LineType>("DIALOGUE");
  const [newLineCharacter, setNewLineCharacter] = useState("");
  const [newLineText, setNewLineText] = useState("");
  const [lineSaving, setLineSaving] = useState(false);

  // Can user write content?
  const canWrite = ["STAGE_MANAGER", "DIRECTOR", "WRITER"].includes(activeRole);

  // Bank of character names from existing lines
  const characterBank = useMemo(() => {
    const names = new Set<string>();
    scenes.forEach((scene) =>
      scene.lines.forEach((line) => {
        if (line.character && line.character.trim()) {
          names.add(line.character.trim().toUpperCase());
        }
      })
    );
    return Array.from(names).sort();
  }, [scenes]);

  // Flatten all lines across scenes, with scene headers injected
  const allLines = useMemo(() => {
    const lines: (ScriptLineView & { _sceneId?: string })[] = [];

    scenes.forEach((scene, si) => {
      if (si === 0 || scene.act !== scenes[si - 1].act) {
        lines.push({
          id: `act-${scene.act}`,
          sceneId: scene.id,
          type: "ACT_HEADER",
          text: `ACT ${scene.act === 1 ? "ONE" : scene.act === 2 ? "TWO" : scene.act === 3 ? "THREE" : String(scene.act)}`,
          sortOrder: -2,
          cues: [],
        });
      }

      lines.push({
        id: `scene-header-${scene.id}`,
        sceneId: scene.id,
        type: "SCENE_HEADER",
        text: `Scene ${scene.scene} — ${scene.title}`,
        sortOrder: -1,
        cues: [],
        _sceneId: scene.id,
      });

      lines.push(...scene.lines);
    });

    return lines;
  }, [scenes]);

  // Build a map of sceneId -> last line index for inserting "add line" buttons
  const sceneEndIndices = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = allLines.length - 1; i >= 0; i--) {
      const sceneId = allLines[i].sceneId;
      if (!(sceneId in map)) {
        map[sceneId] = i;
      }
    }
    return map;
  }, [allLines]);

  // Intersection observer to track visible lines
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const next = new Set(visibleLineIdsRef.current);
          entries.forEach((entry) => {
            const lineId = entry.target.getAttribute("data-line-id");
            if (lineId) {
              if (entry.isIntersecting) {
                next.add(lineId);
              } else {
                next.delete(lineId);
              }
            }
          });
          visibleLineIdsRef.current = next;
          setVisibleLineIds(next);
      },
      { root: container, threshold: 0.1 }
    );

    Object.values(lineRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [allLines, setVisibleLineIds]);

  const handleCueClick = useCallback(
    (cue: CueView) => {
      setActiveCueId(cue.id === activeCueId ? null : cue.id);
    },
    [activeCueId, setActiveCueId]
  );

  const handleAddCue = useCallback(
    (lineId: string, selectedText?: string) => {
      // Find which scene this line belongs to
      const scene = scenes.find((s) => s.lines.some((l) => l.id === lineId));
      openCueEditor(undefined, lineId, scene?.id, selectedText);
    },
    [openCueEditor, scenes]
  );

  const canAddCues = [
    "STAGE_MANAGER",
    "LIGHTING",
    "SOUND",
    "SET_DESIGN",
    "PROPS",
    "DIRECTOR",
    "ACTOR",
  ].includes(activeRole);

  const handleTyping = useCallback(
    (lineId: string, field: "text" | "character" | "title", value: string) => {
      broadcast?.({ type: "line-typing", lineId, field, value });
    },
    [broadcast]
  );

  // --- Comment state ---
  const [commentingLine, setCommentingLine] = useState<string | null>(null);
  const [commentSelectedText, setCommentSelectedText] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  const handleAddComment = useCallback(
    (lineId: string, selectedText?: string) => {
      setCommentingLine(lineId);
      setCommentSelectedText(selectedText || null);
      setCommentText("");
    },
    []
  );

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !commentingLine || !projectId) return;
    setCommentSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId: commentingLine,
          scriptRef: commentSelectedText,
          text: commentText.trim(),
          role: activeRole,
        }),
      });
      if (res.ok) {
        const comment = await res.json();
        addComment(commentingLine, comment);
        setCommentingLine(null);
        setCommentText("");
        setCommentSelectedText(null);
      }
    } catch {} finally {
      setCommentSaving(false);
    }
  };

  const handleResolveComment = useCallback(
    async (commentId: string) => {
      if (!projectId) return;
      resolveComment(commentId);
      try {
        await fetch(`/api/projects/${projectId}/comments`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId, resolved: true }),
        });
      } catch {}
    },
    [projectId, resolveComment]
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!projectId) return;
      removeComment(commentId);
      try {
        await fetch(`/api/projects/${projectId}/comments?commentId=${commentId}`, {
          method: "DELETE",
        });
      } catch {}
    },
    [projectId, removeComment]
  );

  const handleCreateScene = async () => {
    if (!newSceneTitle.trim() || !projectId) return;
    setSceneSaving(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          act: Number(newAct),
          scene: Number(newSceneNum),
          title: newSceneTitle.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create scene");
        return;
      }

      const scene = await res.json();
      addScene(scene);
      broadcast?.({ type: "scene-add", scene });
      setShowAddScene(false);
      setNewSceneTitle("");
      setNewSceneNum(String(Number(newSceneNum) + 1));
    } catch {
      alert("Failed to create scene");
    } finally {
      setSceneSaving(false);
    }
  };

  const handleCreateLine = async () => {
    if (!newLineText.trim() || !addingLineToScene || !projectId) return;
    setLineSaving(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: addingLineToScene,
          type: newLineType,
          character: newLineType === "DIALOGUE" || newLineType === "SONG"
            ? newLineCharacter.trim() || null
            : null,
          text: newLineText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to add line");
        return;
      }

      const line = await res.json();
      addLineToScene(addingLineToScene, line);
      broadcast?.({ type: "line-add", sceneId: addingLineToScene, line });
      setNewLineText("");
      setNewLineCharacter("");
      // Keep the form open for rapid entry
    } catch {
      alert("Failed to add line");
    } finally {
      setLineSaving(false);
    }
  };

  const handleEditLine = useCallback(
    async (lineId: string, updates: { text?: string; character?: string }) => {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/scenes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, ...updates }),
        });
        if (!res.ok) return;
        const data = await res.json();
        // Find which scene this line belongs to
        const scene = scenes.find((s) => s.lines.some((l) => l.id === lineId));
        if (scene) {
          updateLine(scene.id, lineId, { text: data.text, character: data.character });
          broadcast?.({ type: "line-update", sceneId: scene.id, lineId, updates: { text: data.text, character: data.character } });
        }
      } catch {}
    },
    [projectId, scenes, updateLine, broadcast]
  );

  const handleDeleteLine = useCallback(
    async (lineId: string) => {
      if (!projectId) return;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/scenes?lineId=${lineId}`,
          { method: "DELETE" }
        );
        if (!res.ok) return;
        const scene = scenes.find((s) => s.lines.some((l) => l.id === lineId));
        if (scene) {
          deleteLine(scene.id, lineId);
          broadcast?.({ type: "line-delete", sceneId: scene.id, lineId });
        }
      } catch {}
    },
    [projectId, scenes, deleteLine, broadcast]
  );

  const handleEditSceneTitle = useCallback(
    async (sceneId: string, title: string) => {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/scenes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId, title }),
        });
        if (!res.ok) return;
        updateSceneTitle(sceneId, title);
        broadcast?.({ type: "scene-title", sceneId, title });
      } catch {}
    },
    [projectId, updateSceneTitle, broadcast]
  );

  const handleDeleteScene = useCallback(
    async (sceneId: string) => {
      if (!projectId) return;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/scenes?sceneId=${sceneId}`,
          { method: "DELETE" }
        );
        if (!res.ok) return;
        deleteScene(sceneId);
        broadcast?.({ type: "scene-delete", sceneId });
      } catch {}
    },
    [projectId, deleteScene, broadcast]
  );

  // Group scenes for "add line" buttons
  const sceneIds = scenes.map((s) => s.id);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      style={{ padding: isMobile ? "0 8px 80px" : "0 32px 80px" }}
    >
      {/* Sticky format toolbar */}
      {canWrite && (
        <div
          className="sticky top-0 z-10 flex items-center justify-center gap-1 py-2 px-1"
          style={{
            background: "#13120f",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <FormatBarButton
            label="B"
            title="Bold (Ctrl+B)"
            bold
            onClick={() => {
              document.execCommand("bold", false);
              restoreFocusToEditor();
            }}
          />
          <FormatBarButton
            label={"\u2022 List"}
            title="Toggle bullet on current line"
            onClick={() => {
              toggleBulletOnCurrentLine();
              restoreFocusToEditor();
            }}
          />
          <FormatBarButton
            label={"\u2192 Indent"}
            title="Indent current line (Tab)"
            onClick={() => {
              indentCurrentLine();
              restoreFocusToEditor();
            }}
          />
          <FormatBarButton
            label={"\u2190 Outdent"}
            title="Outdent current line (Shift+Tab)"
            onClick={() => {
              outdentCurrentLine();
              restoreFocusToEditor();
            }}
          />
        </div>
      )}
      <div style={{ maxWidth: isMobile ? "100%" : 740, margin: "0 auto", paddingTop: isMobile ? 8 : 16 }}>
        {allLines.map((line, idx) => {
          const isSceneEnd = sceneIds.some(
            (sid) => sceneEndIndices[sid] === idx
          );
          const endSceneId = isSceneEnd
            ? Object.entries(sceneEndIndices).find(([, i]) => i === idx)?.[0]
            : null;

          return (
            <div key={line.id}>
              <ScriptLine
                ref={(el) => {
                  lineRefs.current[line.id] = el;
                }}
                line={line}
                visibleCueTypes={roleConfig.visibleCueTypes}
                activeCueId={activeCueId}
                activeRole={activeRole}
                onCueClick={handleCueClick}
                onAddCue={handleAddCue}
                onAddComment={handleAddComment}
                showAddButton={canAddCues}
                canEdit={canWrite}
                scriptTextSize={scriptTextSize}
                onEditLine={handleEditLine}
                onDeleteLine={handleDeleteLine}
                onEditSceneTitle={handleEditSceneTitle}
                onDeleteScene={handleDeleteScene}
                onTyping={handleTyping}
                onResolveComment={handleResolveComment}
                onDeleteComment={handleDeleteComment}
              />

              {/* Inline comment form */}
              {commentingLine === line.id && (
                <div
                  className="ml-4 mt-1 mb-2 p-3 rounded-lg"
                  style={{
                    background: "rgba(71, 184, 232, 0.05)",
                    border: "1px solid rgba(71, 184, 232, 0.2)",
                  }}
                >
                  {commentSelectedText && (
                    <div
                      className="mb-2 px-2 py-1 rounded"
                      style={{
                        fontFamily: "Libre Baskerville, serif",
                        fontSize: 12,
                        color: "#888",
                        fontStyle: "italic",
                        background: "rgba(255,255,255,0.03)",
                        borderLeft: "2px solid #47B8E8",
                      }}
                    >
                      &ldquo;{commentSelectedText}&rdquo;
                    </div>
                  )}
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="w-full px-3 py-2 rounded resize-none"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 13,
                      background: "#13120f",
                      border: "1px solid #2a2720",
                      color: "#e0ddd5",
                      outline: "none",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSubmitComment();
                      }
                      if (e.key === "Escape") {
                        setCommentingLine(null);
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSubmitComment}
                      disabled={commentSaving || !commentText.trim()}
                      className="px-3 py-1.5 rounded transition-colors"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#47B8E8",
                        background: "rgba(71, 184, 232, 0.1)",
                        border: "1px solid rgba(71, 184, 232, 0.3)",
                        opacity: commentSaving || !commentText.trim() ? 0.5 : 1,
                      }}
                    >
                      {commentSaving ? "Posting..." : "Comment"}
                    </button>
                    <button
                      onClick={() => setCommentingLine(null)}
                      className="px-3 py-1.5 rounded transition-colors hover:bg-white/5"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 11,
                        color: "#888",
                        border: "1px solid #333",
                      }}
                    >
                      Cancel
                    </button>
                    <span
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 10,
                        color: "#555",
                        alignSelf: "center",
                      }}
                    >
                      Ctrl+Enter to submit
                    </span>
                  </div>
                </div>
              )}

              {/* Add line button at end of each scene */}
              {isSceneEnd && endSceneId && canWrite && (
                <div style={{ marginTop: 4, marginBottom: 16 }}>
                  {addingLineToScene === endSceneId ? (
                    <div
                      className="p-3 rounded-lg space-y-2"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid #2a2720",
                      }}
                    >
                      <div className="flex gap-2 items-center">
                        <select
                          value={newLineType}
                          onChange={(e) => setNewLineType(e.target.value as LineType)}
                          className="px-2 py-1.5 rounded"
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: isMobile ? 14 : 22,
                            background: "#13120f",
                            border: "1px solid #2a2720",
                            color: "#e0ddd5",
                            outline: "none",
                          }}
                        >
                          {LINE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {(newLineType === "DIALOGUE" || newLineType === "SONG") && (
                          <CharacterPicker
                            value={newLineCharacter}
                            onChange={setNewLineCharacter}
                            characters={characterBank}
                            isMobile={isMobile}
                          />
                        )}
                      </div>

                      <textarea
                        value={newLineText}
                        onChange={(e) => setNewLineText(e.target.value)}
                        placeholder={
                          newLineType === "DIALOGUE"
                            ? "Enter dialogue..."
                            : newLineType === "STAGE_DIRECTION"
                            ? "Enter stage direction..."
                            : newLineType === "SONG"
                            ? "Enter lyrics..."
                            : "Enter transition..."
                        }
                        rows={3}
                        className="w-full px-3 py-2 rounded resize-y"
                        style={{
                          fontFamily:
                            newLineType === "DIALOGUE" || newLineType === "SONG"
                              ? "Libre Baskerville, serif"
                              : "DM Mono, monospace",
                          fontSize: isMobile ? 14 : 22,
                          background: "#13120f",
                          border: "1px solid #2a2720",
                          color: "#e0ddd5",
                          outline: "none",
                          lineHeight: 1.7,
                          fontStyle:
                            newLineType === "STAGE_DIRECTION" ? "italic" : "normal",
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleCreateLine();
                          }
                        }}
                        autoFocus
                      />

                      <div className="flex gap-2 items-center">
                        <button
                          onClick={handleCreateLine}
                          disabled={lineSaving || !newLineText.trim()}
                          className="px-4 py-2 rounded transition-colors"
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 18,
                            fontWeight: 600,
                            color: "#E8C547",
                            background: "#E8C54715",
                            border: "1px solid #E8C54740",
                            opacity: lineSaving || !newLineText.trim() ? 0.5 : 1,
                          }}
                        >
                          {lineSaving ? "Adding..." : "Add Line"}
                        </button>
                        <span
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 16,
                            color: "#555",
                          }}
                        >
                          Ctrl+Enter to submit
                        </span>
                        <button
                          onClick={async () => {
                            if (newLineText.trim()) {
                              await handleCreateLine();
                            }
                            setAddingLineToScene(null);
                            setNewLineText("");
                            setNewLineCharacter("");
                          }}
                          className="px-4 py-2 rounded transition-colors hover:bg-white/5 ml-auto"
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 18,
                            color: "#888",
                            border: "1px solid #333",
                          }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingLineToScene(endSceneId)}
                      className="w-full px-4 py-3 rounded-lg transition-colors hover:bg-white/3"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 18,
                        color: "#555",
                        border: "1px dashed #2a2720",
                      }}
                    >
                      + Add line
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {allLines.length === 0 && !showAddScene && (
          <div className="text-center py-20">
            <p
              style={{
                fontFamily: "Playfair Display, serif",
                fontSize: 20,
                color: "#555",
              }}
            >
              No script content yet
            </p>
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                color: "#444",
                marginTop: 8,
              }}
            >
              {canWrite
                ? "Add a scene below to start writing"
                : "Waiting for content to be added"}
            </p>
          </div>
        )}

        {/* Add Scene button / form */}
        {canWrite && (
          <div style={{ marginTop: 24 }}>
            {showAddScene ? (
              <div
                className="p-4 rounded-lg space-y-3"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid #2a2720",
                }}
              >
                <div
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: Math.round(scriptTextSize * 0.55),
                    color: "#888",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  New Scene
                </div>

                <div className="flex gap-3">
                  <div style={{ width: 80 }}>
                    <label
                      className="block mb-1"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: Math.round(scriptTextSize * 0.5),
                        color: "#888",
                      }}
                    >
                      Act
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newAct}
                      onChange={(e) => setNewAct(e.target.value)}
                      className="w-full px-3 py-2 rounded"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: scriptTextSize,
                        background: "#13120f",
                        border: "1px solid #2a2720",
                        color: "#e0ddd5",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <label
                      className="block mb-1"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: Math.round(scriptTextSize * 0.5),
                        color: "#888",
                      }}
                    >
                      Scene
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newSceneNum}
                      onChange={(e) => setNewSceneNum(e.target.value)}
                      className="w-full px-3 py-2 rounded"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: scriptTextSize,
                        background: "#13120f",
                        border: "1px solid #2a2720",
                        color: "#e0ddd5",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      className="block mb-1"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: Math.round(scriptTextSize * 0.5),
                        color: "#888",
                      }}
                    >
                      Title
                    </label>
                    <input
                      type="text"
                      value={newSceneTitle}
                      onChange={(e) => setNewSceneTitle(e.target.value)}
                      placeholder="e.g. The Arrival"
                      className="w-full px-3 py-2 rounded"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: scriptTextSize,
                        background: "#13120f",
                        border: "1px solid #2a2720",
                        color: "#e0ddd5",
                        outline: "none",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateScene();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAddScene(false);
                      setNewSceneTitle("");
                    }}
                    className="px-3 py-1.5 rounded transition-colors hover:bg-white/5"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 11,
                      color: "#888",
                      border: "1px solid #333",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateScene}
                    disabled={sceneSaving || !newSceneTitle.trim()}
                    className="px-3 py-1.5 rounded transition-colors"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#E8C547",
                      background: "#E8C54715",
                      border: "1px solid #E8C54740",
                      opacity: sceneSaving || !newSceneTitle.trim() ? 0.5 : 1,
                    }}
                  >
                    {sceneSaving ? "Creating..." : "Add Scene"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddScene(true)}
                className="w-full px-4 py-3 rounded-lg transition-colors hover:bg-white/3"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                  color: "#666",
                  border: "1px dashed #333",
                }}
              >
                + Add Scene
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Character name picker with bank ----

function CharacterPicker({
  value,
  onChange,
  characters,
  isMobile,
}: {
  value: string;
  onChange: (v: string) => void;
  characters: string[];
  isMobile: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filter
    ? characters.filter((c) => c.includes(filter.toUpperCase()))
    : characters;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const selectCharacter = (name: string) => {
    onChange(name);
    setFilter("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? filter : value}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            if (isOpen) {
              setFilter(v);
            } else {
              onChange(v);
            }
          }}
          onFocus={() => {
            if (characters.length > 0) {
              setIsOpen(true);
              setFilter(value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && isOpen) {
              e.preventDefault();
              if (filter.trim()) {
                selectCharacter(filter.trim().toUpperCase());
              } else if (filtered.length > 0) {
                selectCharacter(filtered[0]);
              }
            }
            if (e.key === "Escape") {
              setIsOpen(false);
              setFilter("");
            }
          }}
          placeholder={characters.length > 0 ? "Select or type..." : "CHARACTER"}
          className="px-2 py-1.5 rounded"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: isMobile ? 14 : 22,
            width: isMobile ? 140 : 200,
            background: "#13120f",
            border: "1px solid #2a2720",
            color: "#E8C547",
            fontWeight: 700,
            outline: "none",
          }}
        />
        {characters.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) {
                setFilter("");
                inputRef.current?.focus();
              }
            }}
            className="px-1.5 py-1.5 rounded hover:bg-white/5 transition-colors"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: isMobile ? 12 : 18,
              color: "#666",
              border: "1px solid #2a2720",
              background: "#13120f",
              lineHeight: 1,
            }}
          >
            ▾
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden"
          style={{
            background: "#1a1916",
            border: "1px solid #2a2720",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            maxHeight: 200,
            overflowY: "auto",
            minWidth: isMobile ? 140 : 200,
          }}
        >
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => selectCharacter(name)}
              className="w-full text-left px-3 py-2 transition-colors hover:bg-white/5"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: isMobile ? 13 : 18,
                fontWeight: 700,
                color: name === value ? "#E8C547" : "#c8c0b0",
                background: name === value ? "#E8C54710" : "transparent",
              }}
            >
              {name}
            </button>
          ))}
          {filter && !characters.includes(filter.toUpperCase()) && (
            <button
              type="button"
              onClick={() => selectCharacter(filter.trim().toUpperCase())}
              className="w-full text-left px-3 py-2 transition-colors hover:bg-white/5"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: isMobile ? 13 : 18,
                color: "#47E86A",
                borderTop: filtered.length > 0 ? "1px solid #2a2720" : "none",
              }}
            >
              + Add &ldquo;{filter.toUpperCase()}&rdquo;
            </button>
          )}
          {!filter && filtered.length === 0 && (
            <div
              className="px-3 py-2"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: isMobile ? 12 : 16,
                color: "#555",
              }}
            >
              Type a character name
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Format bar helpers (shared with ScriptLine) ----

function getCurrentLineText(): { text: string; node: Text; offset: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  let node: Node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) {
    if (node.childNodes.length > 0 && range.startOffset < node.childNodes.length) {
      node = node.childNodes[range.startOffset];
    }
    if (node.nodeType !== Node.TEXT_NODE) return null;
  }
  const text = node.textContent || "";
  return { text, node: node as Text, offset: range.startOffset };
}

function indentCurrentLine() {
  const info = getCurrentLineText();
  if (!info) {
    document.execCommand("insertText", false, "    ");
    return;
  }
  const { text, node, offset } = info;
  const beforeCursor = text.slice(0, offset);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const newText = text.slice(0, lineStart) + "    " + text.slice(lineStart);
  node.textContent = newText;
  const sel = window.getSelection();
  const newRange = document.createRange();
  newRange.setStart(node, offset + 4);
  newRange.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(newRange);
}

function outdentCurrentLine() {
  const info = getCurrentLineText();
  if (!info) return;
  const { text, node, offset } = info;
  const beforeCursor = text.slice(0, offset);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const lineContent = text.slice(lineStart);
  const spacesMatch = lineContent.match(/^( {1,4})/);
  if (!spacesMatch) return;
  const spacesRemoved = spacesMatch[1].length;
  const newText = text.slice(0, lineStart) + text.slice(lineStart + spacesRemoved);
  node.textContent = newText;
  const sel = window.getSelection();
  const newRange = document.createRange();
  newRange.setStart(node, Math.max(lineStart, offset - spacesRemoved));
  newRange.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(newRange);
}

function toggleBulletOnCurrentLine() {
  const info = getCurrentLineText();
  if (!info) {
    document.execCommand("insertText", false, "\u2022 ");
    return;
  }
  const { text, node, offset } = info;
  const beforeCursor = text.slice(0, offset);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const lineContent = text.slice(lineStart);
  const sel = window.getSelection();

  if (lineContent.startsWith("\u2022 ")) {
    const newText = text.slice(0, lineStart) + text.slice(lineStart + 2);
    node.textContent = newText;
    const newRange = document.createRange();
    newRange.setStart(node, Math.max(lineStart, offset - 2));
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);
  } else {
    const newText = text.slice(0, lineStart) + "\u2022 " + text.slice(lineStart);
    node.textContent = newText;
    const newRange = document.createRange();
    newRange.setStart(node, offset + 2);
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);
  }
}

function restoreFocusToEditor() {
  // Try to refocus the last active contentEditable element
  const active = document.querySelector("[contenteditable]:focus") as HTMLElement;
  if (active) active.focus();
}

function FormatBarButton({ label, title, onClick, bold }: { label: string; title: string; onClick: () => void; bold?: boolean }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      style={{
        fontFamily: "DM Mono, monospace",
        fontSize: 12,
        fontWeight: bold ? 900 : 400,
        color: "#999",
        background: "transparent",
        border: "1px solid #333",
        borderRadius: 4,
        padding: "4px 10px",
        cursor: "pointer",
        lineHeight: 1.4,
      }}
      className="hover:bg-white/5 transition-colors"
    >
      {label}
    </button>
  );
}

export function scrollToLine(
  lineId: string,
  lineRefs: Record<string, HTMLDivElement | null>
) {
  const el = lineRefs[lineId];
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
