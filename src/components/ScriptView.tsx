"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useStageStore } from "@/lib/store";
import { ROLES } from "@/lib/roles";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ScriptLine } from "./ScriptLine";
import type { CueView, ScriptLineView, LineType, SceneView } from "@/types";

interface ScriptViewProps {
  broadcast?: (msg: any) => void;
  projectId?: string;
  updateCursor?: (lineId: string | null, field?: "text" | "character" | "title" | null) => void;
}

// ---- Helpers ----

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function actNumToWord(act: number): string {
  const words: Record<number, string> = { 0: "ZERO", 1: "ONE", 2: "TWO", 3: "THREE", 4: "FOUR", 5: "FIVE" };
  return words[act] || String(act);
}

function isCharacterName(line: string): boolean {
  const t = line.trim();
  return (
    t.length > 0 &&
    t.length < 40 &&
    t === t.toUpperCase() &&
    /^[A-Z][A-Z\s\-'\.]+$/.test(t) &&
    !["THE END", "BLACKOUT", "LIGHTS UP", "CURTAIN", "INTERMISSION", "PROLOGUE", "EPILOGUE", "ACT", "SCENE"].includes(t)
  );
}

const CHAR_NAME_STYLE =
  "font-family:DM Mono,monospace;font-weight:700;color:var(--stage-gold);letter-spacing:0.05em;margin-top:0.3em;";

function sceneLinesToHtml(lines: ScriptLineView[]): string {
  if (lines.length === 0) return "";

  // Structured lines (multiple lines or line with character field)
  if (lines.length > 1 || (lines[0].character)) {
    return lines
      .map((line) => {
        if ((line.type === "DIALOGUE" || line.type === "SONG") && line.character) {
          const c = escapeHtml(line.character);
          const t = line.text ? escapeHtml(line.text).replace(/\n/g, "<br>") : "<br>";
          return `<div data-character="${c}" style="${CHAR_NAME_STYLE}">${c}</div><div>${t}</div>`;
        }
        if (line.type === "STAGE_DIRECTION" || line.type === "TRANSITION") {
          const t = line.text ? escapeHtml(line.text).replace(/\n/g, "<br>") : "<br>";
          return `<div style="font-style:italic;">${t}</div>`;
        }
        const t = line.text ? escapeHtml(line.text).replace(/\n/g, "<br>") : "<br>";
        return `<div>${t}</div>`;
      })
      .join("");
  }

  // Single text blob — detect character names by ALL_CAPS heuristic
  // Skip empty lines to avoid persistent spacing gaps
  const text = lines[0].text || "";
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      if (isCharacterName(line)) {
        const c = escapeHtml(line.trim());
        return `<div data-character="${c}" style="${CHAR_NAME_STYLE}">${c}</div>`;
      }
      return `<div>${escapeHtml(line)}</div>`;
    })
    .join("");
}

function linesToText(lines: ScriptLineView[]): string {
  if (lines.length === 0) return "";
  if (lines.length === 1 && !lines[0].character) return lines[0].text;
  return lines
    .map((line) => {
      if ((line.type === "DIALOGUE" || line.type === "SONG") && line.character) {
        return `${line.character}\n${line.text}`;
      }
      return line.text;
    })
    .join("\n");
}

// ---- Main Component ----

export function ScriptView({ broadcast, projectId: projectIdProp, updateCursor }: ScriptViewProps) {
  const {
    activeRole,
    projectId: storeProjectId,
    scenes,
    activeCueId,
    setActiveCueId,
    openCueEditor,
    addScene,
    addLineToScene,
    updateSceneTitle,
    updateLine,
    deleteLine,
    deleteScene,
    scriptTextSize,
    pendingDialogue,
    setPendingDialogue,
  } = useStageStore();

  const projectId = projectIdProp || storeProjectId;
  const containerRef = useRef<HTMLDivElement>(null);
  const roleConfig = ROLES[activeRole];
  const isMobile = useIsMobile();

  // Scene editor refs for character insertion + live sync
  const sceneEditorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastFocusedSceneRef = useRef<string | null>(null);
  // Track last cursor position so character insertion works after editor blur
  const lastEditorRangeRef = useRef<{ sceneId: string; range: Range } | null>(null);

  // Save cursor position whenever selection changes inside a scene editor
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      for (const [sceneId, editor] of Object.entries(sceneEditorRefs.current)) {
        if (editor && editor.contains(range.commonAncestorContainer)) {
          lastEditorRangeRef.current = { sceneId, range: range.cloneRange() };
          break;
        }
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  // --- Add scene state ---
  const [showAddScene, setShowAddScene] = useState(false);
  const [scenePosition, setScenePosition] = useState<string>("end");
  const [newAct, setNewAct] = useState("0");
  const [newSceneNum, setNewSceneNum] = useState("0");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [sceneSaving, setSceneSaving] = useState(false);

  const canWrite = ["STAGE_MANAGER", "DIRECTOR", "WRITER"].includes(activeRole);

  // --- Undo stack ---
  type UndoAction =
    | { type: "edit-line"; sceneId: string; lineId: string; prev: { text?: string; character?: string } }
    | { type: "edit-title"; sceneId: string; prev: string };
  const undoStackRef = useRef<UndoAction[]>([]);
  const [undoCount, setUndoCount] = useState(0);

  const handleCueClick = useCallback(
    (cue: CueView) => {
      setActiveCueId(cue.id === activeCueId ? null : cue.id);
    },
    [activeCueId, setActiveCueId]
  );

  const canAddCues = [
    "STAGE_MANAGER", "LIGHTING", "SOUND", "SET_DESIGN", "PROPS", "DIRECTOR", "ACTOR",
  ].includes(activeRole);

  // Broadcast typing for live sync
  const handleSceneTyping = useCallback(
    (sceneId: string, value: string) => {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene || scene.lines.length === 0) return;
      const lineId = scene.lines[0].id;
      broadcast?.({ type: "line-typing", lineId, field: "text", value });
    },
    [scenes, broadcast]
  );

  const handleTyping = useCallback(
    (lineId: string, field: "text" | "character" | "title", value: string) => {
      broadcast?.({ type: "line-typing", lineId, field, value });
    },
    [broadcast]
  );

  const handleUpdateCursor = useCallback(
    (lineId: string | null, field?: "text" | "character" | "title" | null) => {
      if (lineId) {
        const scene = scenes.find((s) => s.lines.some((l) => l.id === lineId));
        if (scene) lastFocusedSceneRef.current = scene.id;
      }
      updateCursor?.(lineId, field);
    },
    [scenes, updateCursor]
  );

  // Focus/blur cursor tracking for scene editors
  const handleSceneFocus = useCallback(
    (sceneId: string) => {
      lastFocusedSceneRef.current = sceneId;
      const scene = scenes.find((s) => s.id === sceneId);
      if (scene && scene.lines.length > 0) {
        updateCursor?.(scene.lines[0].id, "text");
      }
    },
    [scenes, updateCursor]
  );

  const handleSceneBlur = useCallback(() => {
    updateCursor?.(null);
  }, [updateCursor]);

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
          position: scenePosition,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create scene");
        return;
      }
      const scene = await res.json();
      addScene(scene, scenePosition);
      broadcast?.({ type: "scene-add", scene, position: scenePosition });
      setShowAddScene(false);
      setNewSceneTitle("");
      setNewSceneNum(String(Number(newSceneNum) + 1));
    } catch {
      alert("Failed to create scene");
    } finally {
      setSceneSaving(false);
    }
  };

  // Create a new line in a scene
  const handleCreateLine = useCallback(
    async (sceneId: string, type: LineType, text: string) => {
      if (!text.trim() || !projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/scenes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId, type, text: text.trim() }),
        });
        if (!res.ok) return;
        const line = await res.json();
        addLineToScene(sceneId, line);
        broadcast?.({ type: "line-add", sceneId, line });
        return line;
      } catch {}
    },
    [projectId, addLineToScene, broadcast]
  );

  // Save scene content from single text box
  const handleSaveSceneContent = useCallback(
    async (sceneId: string, content: string) => {
      if (!projectId) return;
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) return;

      if (scene.lines.length > 0) {
        const firstLine = scene.lines[0];
        const prevText = linesToText(scene.lines);

        try {
          const res = await fetch(`/api/projects/${projectId}/scenes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lineId: firstLine.id, text: content }),
          });
          if (!res.ok) return;

          undoStackRef.current.push({
            type: "edit-line",
            sceneId,
            lineId: firstLine.id,
            prev: { text: prevText },
          });
          setUndoCount(undoStackRef.current.length);

          updateLine(sceneId, firstLine.id, { text: content });
          broadcast?.({
            type: "line-update",
            sceneId,
            lineId: firstLine.id,
            updates: { text: content },
          });

          // Remove extra lines (consolidate to single line)
          for (const line of scene.lines.slice(1)) {
            try {
              await fetch(`/api/projects/${projectId}/scenes?lineId=${line.id}`, {
                method: "DELETE",
              });
              deleteLine(sceneId, line.id);
              broadcast?.({ type: "line-delete", sceneId, lineId: line.id });
            } catch {}
          }
        } catch {}
      } else if (content.trim()) {
        await handleCreateLine(sceneId, "STAGE_DIRECTION", content);
      }
    },
    [projectId, scenes, updateLine, deleteLine, handleCreateLine, broadcast]
  );

  // Handle pending dialogue from Writer panel character click
  useEffect(() => {
    if (!pendingDialogue || scenes.length === 0) return;
    const { character } = pendingDialogue;
    setPendingDialogue(null);

    const targetSceneId =
      lastFocusedSceneRef.current && scenes.find((s) => s.id === lastFocusedSceneRef.current)
        ? lastFocusedSceneRef.current
        : scenes[scenes.length - 1].id;

    const editor = sceneEditorRefs.current[targetSceneId];
    if (!editor) return;

    editor.focus();

    // Restore saved cursor position (clicking the character button blurs the editor)
    const sel = window.getSelection();
    if (sel) {
      const saved = lastEditorRangeRef.current;
      if (saved && saved.sceneId === targetSceneId && editor.contains(saved.range.commonAncestorContainer)) {
        sel.removeAllRanges();
        sel.addRange(saved.range);
      } else if (sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
        // Fallback: place cursor at end
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    // Build the character name element and dialogue line
    const charDiv = document.createElement("div");
    charDiv.setAttribute("data-character", character);
    charDiv.setAttribute("style", CHAR_NAME_STYLE);
    charDiv.textContent = character;

    const dialogueDiv = document.createElement("div");
    dialogueDiv.appendChild(document.createElement("br"));

    // Insert at cursor using Range API
    const range = sel?.getRangeAt(0);
    if (!range) return;

    // If cursor is inside a text node, split at cursor and insert after
    range.deleteContents();

    // Insert dialogue line first, then character name before it (insertNode prepends)
    const frag = document.createDocumentFragment();
    frag.appendChild(charDiv);
    frag.appendChild(dialogueDiv);
    range.insertNode(frag);

    // Place cursor inside the dialogue div so user can type immediately
    const newRange = document.createRange();
    newRange.selectNodeContents(dialogueDiv);
    newRange.collapse(true);
    sel!.removeAllRanges();
    sel!.addRange(newRange);

    // Trigger input event so typing broadcast fires
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }, [pendingDialogue, scenes, setPendingDialogue]);

  const handleEditSceneTitle = useCallback(
    async (sceneId: string, title: string) => {
      if (!projectId) return;
      const prevScene = scenes.find((s) => s.id === sceneId);
      const prevTitle = prevScene?.title || "";
      try {
        const res = await fetch(`/api/projects/${projectId}/scenes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId, title }),
        });
        if (!res.ok) return;
        undoStackRef.current.push({ type: "edit-title", sceneId, prev: prevTitle });
        setUndoCount(undoStackRef.current.length);
        updateSceneTitle(sceneId, title);
        broadcast?.({ type: "scene-title", sceneId, title });
      } catch {}
    },
    [projectId, scenes, updateSceneTitle, broadcast]
  );

  const handleDeleteScene = useCallback(
    async (sceneId: string) => {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/scenes?sceneId=${sceneId}`, {
          method: "DELETE",
        });
        if (!res.ok) return;
        deleteScene(sceneId);
        broadcast?.({ type: "scene-delete", sceneId });
      } catch {}
    },
    [projectId, deleteScene, broadcast]
  );

  const handleUndo = useCallback(async () => {
    const action = undoStackRef.current.pop();
    if (!action || !projectId) return;
    setUndoCount(undoStackRef.current.length);

    if (action.type === "edit-line") {
      try {
        const res = await fetch(`/api/projects/${projectId}/scenes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId: action.lineId, ...action.prev }),
        });
        if (!res.ok) return;
        const data = await res.json();
        updateLine(action.sceneId, action.lineId, {
          text: data.text,
          character: data.character,
        });
        broadcast?.({
          type: "line-update",
          sceneId: action.sceneId,
          lineId: action.lineId,
          updates: { text: data.text, character: data.character },
        });
      } catch {}
    } else if (action.type === "edit-title") {
      try {
        const res = await fetch(`/api/projects/${projectId}/scenes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId: action.sceneId, title: action.prev }),
        });
        if (!res.ok) return;
        updateSceneTitle(action.sceneId, action.prev);
        broadcast?.({ type: "scene-title", sceneId: action.sceneId, title: action.prev });
      } catch {}
    }
  }, [projectId, updateLine, updateSceneTitle, broadcast]);

  // Ctrl+Z global undo shortcut
  useEffect(() => {
    if (!canWrite) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        const active = document.activeElement;
        if (active && ((active as HTMLElement).isContentEditable || active.tagName === "TEXTAREA"))
          return;
        if (undoStackRef.current.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canWrite, handleUndo]);

  // Toolbar formatting helpers
  const applyStageDirection = useCallback(() => {
    document.execCommand("italic", false);
    // Re-focus the editor
    const active = document.querySelector("[contenteditable]:focus") as HTMLElement;
    if (active) active.focus();
  }, []);

  const insertCharacterAtCursor = useCallback(
    (character: string) => {
      const active = document.querySelector("[contenteditable]:focus") as HTMLElement;
      if (!active) return;
      const charHtml = `<div data-character="${character}" style="${CHAR_NAME_STYLE}">${character}</div><div><br></div>`;
      document.execCommand("insertHTML", false, charHtml);
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      style={{ padding: isMobile ? "0 8px 80px" : "0 32px 80px" }}
    >
      {/* Sticky toolbar */}
      {canWrite && (
        <div
          className="sticky top-0 z-10 flex items-center justify-center gap-1 py-2 px-1"
          style={{
            background: "var(--stage-bg)",
            borderBottom: "1px solid var(--stage-hover)",
          }}
        >
          <ToolbarButton
            label="Stage Direction"
            title="Toggle italic stage direction (Ctrl+I)"
            italic
            onClick={applyStageDirection}
          />
          <div style={{ width: 1, height: 18, background: "var(--stage-border)", margin: "0 4px" }} />
          <ToolbarButton
            label={`\u21A9 Undo${undoCount > 0 ? ` (${undoCount})` : ""}`}
            title="Undo last edit (Ctrl+Z)"
            onClick={handleUndo}
            disabled={undoCount === 0}
          />
        </div>
      )}

      <div
        style={{
          maxWidth: isMobile ? "100%" : 740,
          margin: "0 auto",
          paddingTop: isMobile ? 8 : 16,
        }}
      >
        {/* Add scene at the top */}
        {canWrite && scenes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {showAddScene && scenePosition === "start" ? (
              <AddSceneForm
                newAct={newAct} setNewAct={setNewAct}
                newSceneNum={newSceneNum} setNewSceneNum={setNewSceneNum}
                newSceneTitle={newSceneTitle} setNewSceneTitle={setNewSceneTitle}
                sceneSaving={sceneSaving} scriptTextSize={scriptTextSize}
                onSubmit={handleCreateScene}
                onCancel={() => { setShowAddScene(false); setNewSceneTitle(""); }}
              />
            ) : (
              <button
                onClick={() => { setScenePosition("start"); setShowAddScene(true); }}
                className="w-full px-4 py-3 rounded-lg transition-colors hover:bg-white/3"
                style={{ fontFamily: "DM Mono, monospace", fontSize: 16, color: "var(--stage-dim)", border: "1px dashed var(--stage-border-subtle)" }}
              >
                + Add Scene Before
              </button>
            )}
          </div>
        )}

        {scenes.map((scene, si) => {
          const isNewAct = si === 0 || scene.act !== scenes[si - 1].act;
          const actKey = String(scene.act);
          const afterActPos = `after-act-${actKey}`;

          return (
            <div key={scene.id}>
              {/* ACT header */}
              {isNewAct && (
                <>
                  <div
                    className="pt-8 pb-4 text-center"
                    style={{
                      fontFamily: "Playfair Display, serif",
                      fontSize: 28, fontWeight: 700, letterSpacing: "0.15em",
                      color: "var(--stage-gold)",
                      borderBottom: "1px solid rgba(232, 197, 71, 0.18)",
                      marginBottom: 16,
                    }}
                  >
                    ACT {actNumToWord(scene.act)}
                  </div>
                  {canWrite && (
                    <div style={{ margin: "8px 0" }}>
                      {showAddScene && scenePosition === afterActPos ? (
                        <AddSceneForm
                          newAct={newAct} setNewAct={setNewAct}
                          newSceneNum={newSceneNum} setNewSceneNum={setNewSceneNum}
                          newSceneTitle={newSceneTitle} setNewSceneTitle={setNewSceneTitle}
                          sceneSaving={sceneSaving} scriptTextSize={scriptTextSize}
                          onSubmit={handleCreateScene}
                          onCancel={() => { setShowAddScene(false); setNewSceneTitle(""); }}
                        />
                      ) : (
                        <button
                          onClick={() => { setNewAct(actKey); setNewSceneNum("0"); setScenePosition(afterActPos); setShowAddScene(true); }}
                          className="w-full px-4 py-2 rounded-lg transition-colors hover:bg-white/3"
                          style={{ fontFamily: "DM Mono, monospace", fontSize: 14, color: "var(--stage-dim)", border: "1px dashed var(--stage-border-subtle)" }}
                        >
                          + Add Scene
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Scene header */}
              <ScriptLine
                line={{
                  id: `scene-header-${scene.id}`,
                  sceneId: scene.id,
                  type: "SCENE_HEADER" as any,
                  text: `Scene ${scene.scene} \u2014 ${scene.title}`,
                  sortOrder: -1,
                  cues: [],
                  _sceneId: scene.id,
                } as any}
                visibleCueTypes={roleConfig.visibleCueTypes}
                activeCueId={activeCueId}
                activeRole={activeRole}
                onCueClick={handleCueClick}
                canEdit={canWrite}
                scriptTextSize={scriptTextSize}
                onEditSceneTitle={handleEditSceneTitle}
                onDeleteScene={handleDeleteScene}
                onTyping={handleTyping}
                updateCursor={handleUpdateCursor}
              />

              {/* Single text box for all scene content */}
              <SceneTextBox
                scene={scene}
                canEdit={canWrite}
                scriptTextSize={scriptTextSize}
                isMobile={isMobile}
                onSave={(text) => handleSaveSceneContent(scene.id, text)}
                onTyping={(val) => handleSceneTyping(scene.id, val)}
                onFocus={() => handleSceneFocus(scene.id)}
                onBlur={handleSceneBlur}
                editorRef={(el) => { sceneEditorRefs.current[scene.id] = el; }}
              />

              {/* Add scene between */}
              {canWrite && (
                <div style={{ marginTop: 8, marginBottom: 8 }}>
                  {showAddScene && scenePosition === `between-${scene.id}` ? (
                    <AddSceneForm
                      newAct={newAct} setNewAct={setNewAct}
                      newSceneNum={newSceneNum} setNewSceneNum={setNewSceneNum}
                      newSceneTitle={newSceneTitle} setNewSceneTitle={setNewSceneTitle}
                      sceneSaving={sceneSaving} scriptTextSize={scriptTextSize}
                      onSubmit={handleCreateScene}
                      onCancel={() => { setShowAddScene(false); setNewSceneTitle(""); }}
                    />
                  ) : (
                    <button
                      onClick={() => { setNewAct(String(scene.act)); setNewSceneNum(String(scene.scene + 1)); setScenePosition(`between-${scene.id}`); setShowAddScene(true); }}
                      className="w-full px-4 py-2 rounded-lg transition-colors hover:bg-white/3"
                      style={{ fontFamily: "DM Mono, monospace", fontSize: 14, color: "var(--stage-dim)", border: "1px dashed var(--stage-border-subtle)" }}
                    >
                      + Add Scene
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {scenes.length === 0 && !showAddScene && (
          <div className="text-center py-20">
            <p style={{ fontFamily: "Playfair Display, serif", fontSize: 20, color: "var(--stage-faint)" }}>
              No script content yet
            </p>
            <p style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "var(--stage-ultra-faint)", marginTop: 8 }}>
              {canWrite ? "Add a scene below to start writing" : "Waiting for content to be added"}
            </p>
          </div>
        )}

        {/* Add Scene at bottom */}
        {canWrite && (
          <div style={{ marginTop: 24 }}>
            {showAddScene && scenePosition === "end" ? (
              <AddSceneForm
                newAct={newAct} setNewAct={setNewAct}
                newSceneNum={newSceneNum} setNewSceneNum={setNewSceneNum}
                newSceneTitle={newSceneTitle} setNewSceneTitle={setNewSceneTitle}
                sceneSaving={sceneSaving} scriptTextSize={scriptTextSize}
                onSubmit={handleCreateScene}
                onCancel={() => { setShowAddScene(false); setNewSceneTitle(""); }}
              />
            ) : (
              <button
                onClick={() => { setScenePosition("end"); setShowAddScene(true); }}
                className="w-full px-4 py-3 rounded-lg transition-colors hover:bg-white/3"
                style={{ fontFamily: "DM Mono, monospace", fontSize: 16, color: "var(--stage-dim)", border: "1px dashed var(--stage-border-subtle)" }}
              >
                + Add Scene
              </button>
            )}
          </div>
        )}

        {/* New Act */}
        {canWrite && (
          <div style={{ marginTop: 12 }}>
            {showAddScene && scenePosition === "new-act" ? (
              <AddSceneForm
                newAct={newAct} setNewAct={setNewAct}
                newSceneNum={newSceneNum} setNewSceneNum={setNewSceneNum}
                newSceneTitle={newSceneTitle} setNewSceneTitle={setNewSceneTitle}
                sceneSaving={sceneSaving} scriptTextSize={scriptTextSize}
                onSubmit={handleCreateScene}
                onCancel={() => { setShowAddScene(false); setNewSceneTitle(""); }}
              />
            ) : (
              <button
                onClick={() => {
                  const maxAct = scenes.reduce((max, s) => Math.max(max, s.act), 0);
                  setNewAct(String(maxAct + 1));
                  setNewSceneNum("1");
                  setScenePosition("new-act");
                  setShowAddScene(true);
                }}
                className="w-full px-4 py-3 rounded-lg transition-colors hover:bg-white/3"
                style={{ fontFamily: "DM Mono, monospace", fontSize: 16, color: "var(--stage-gold)", border: "1px dashed var(--stage-gold-border)" }}
              >
                + New Act
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Scene Text Box (contentEditable) ----

function SceneTextBox({
  scene,
  canEdit,
  scriptTextSize,
  isMobile,
  onSave,
  onTyping,
  onFocus,
  onBlur,
  editorRef,
}: {
  scene: SceneView;
  canEdit: boolean;
  scriptTextSize: number;
  isMobile: boolean;
  onSave: (text: string) => void;
  onTyping?: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  editorRef: (el: HTMLDivElement | null) => void;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const savedTextRef = useRef<string>("");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  // Timestamp of our last save — skip DOM overwrites for 3s after to avoid
  // the store round-trip re-rendering our own content back into the editor.
  const lastSaveTimeRef = useRef(0);

  const initialHtml = useMemo(() => sceneLinesToHtml(scene.lines) || "<div><br></div>", [scene.lines]);
  const initialText = useMemo(() => linesToText(scene.lines), [scene.lines]);

  // Remote cursor indicators for this scene
  const remoteCursors = useStageStore((s) => s.remoteCursors).filter((c) =>
    scene.lines.some((l) => l.id === c.lineId)
  );

  // Set initial content & sync external updates (not our own saves)
  useEffect(() => {
    savedTextRef.current = initialText;
    if (localRef.current && document.activeElement !== localRef.current) {
      // Skip DOM overwrite shortly after our own save to prevent
      // deleted spaces / formatting from being re-injected
      if (Date.now() - lastSaveTimeRef.current < 3000) return;
      localRef.current.innerHTML = initialHtml;
      isDirtyRef.current = false;
    }
  }, [initialHtml, initialText]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const handleInput = useCallback(() => {
    isDirtyRef.current = true;
    if (!localRef.current || !onTyping) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      const text = localRef.current?.innerText || "";
      onTyping(text);
    }, 80);
  }, [onTyping]);

  const handleBlur = useCallback(() => {
    if (!localRef.current) return;
    const currentText = localRef.current.innerText?.trim() || "";
    // Save if content changed OR if user made any edits (isDirty)
    if (isDirtyRef.current || currentText !== savedTextRef.current.trim()) {
      lastSaveTimeRef.current = Date.now();
      isDirtyRef.current = false;
      onSave(currentText);
      savedTextRef.current = currentText;
    }
    onBlur();
  }, [onSave, onBlur]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  if (!canEdit) {
    return (
      <div style={{ position: "relative" }}>
        {remoteCursors.length > 0 && (
          <div style={{ position: "absolute", top: -2, right: 8, zIndex: 5 }}>
            <RemoteCursorIndicator cursors={remoteCursors} />
          </div>
        )}
        <div
          style={{
            fontFamily: "Libre Baskerville, serif",
            fontSize: scriptTextSize,
            color: "var(--stage-text)",
            lineHeight: 1.75,
            padding: isMobile ? "8px" : "8px 16px",
            minHeight: 60,
          }}
          dangerouslySetInnerHTML={{
            __html: initialHtml || '<span style="color:var(--stage-faint);font-style:italic;">No content yet</span>',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16, position: "relative" }}>
      {remoteCursors.length > 0 && (
        <div style={{ position: "absolute", top: -2, right: 8, zIndex: 5 }}>
          <RemoteCursorIndicator cursors={remoteCursors} />
        </div>
      )}
      <div
        ref={(el) => {
          const isInit = !localRef.current && el;
          localRef.current = el;
          editorRef(el);
          if (isInit && el) {
            el.innerHTML = initialHtml;
          }
        }}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={handleInput}
        onFocus={(e) => {
          onFocus();
          e.currentTarget.style.borderColor = "var(--stage-border)";
          e.currentTarget.style.background = "var(--stage-line-hover)";
        }}
        onBlur={(e) => {
          // Don't blur if clicking toolbar
          const related = e.relatedTarget as HTMLElement | null;
          if (related?.closest("[data-toolbar]")) {
            setTimeout(() => localRef.current?.focus(), 0);
            return;
          }
          e.currentTarget.style.borderColor = "var(--stage-border-subtle)";
          e.currentTarget.style.background = "rgba(255,255,255,0.01)";
          handleBlur();
        }}
        onPaste={handlePaste}
        className="w-full rounded-lg transition-colors"
        style={{
          fontFamily: "Libre Baskerville, serif",
          fontSize: isMobile ? 14 : scriptTextSize,
          color: "var(--stage-text)",
          lineHeight: 1.75,
          whiteSpace: "pre-wrap",
          padding: isMobile ? "12px" : "12px 20px",
          background: "rgba(255,255,255,0.01)",
          border: "1px solid var(--stage-border-subtle)",
          borderRadius: 6,
          outline: "none",
          minHeight: 150,
          cursor: "text",
        }}
        data-placeholder="Start writing your scene..."
      />
    </div>
  );
}

// ---- Remote Cursor Indicator ----

function RemoteCursorIndicator({
  cursors,
}: {
  cursors: Array<{ userId: string; name: string; color: string; field: "text" | "character" | "title" | null }>;
}) {
  if (cursors.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 mb-0.5" style={{ minHeight: 18 }}>
      {cursors.map((c) => (
        <div
          key={c.userId}
          className="flex items-center gap-1 animate-fade-in"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 10, fontWeight: 600,
            color: c.color,
            background: `${c.color}15`,
            border: `1px solid ${c.color}40`,
            borderRadius: 3,
            padding: "1px 6px",
            lineHeight: 1.4,
          }}
        >
          <span
            style={{
              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
              background: c.color, animation: "pulse-dot 1.5s ease-in-out infinite",
            }}
          />
          {c.name}
        </div>
      ))}
    </div>
  );
}

// ---- Toolbar Button ----

function ToolbarButton({
  label, title, onClick, bold, italic, disabled,
}: {
  label: string; title: string; onClick: () => void;
  bold?: boolean; italic?: boolean; disabled?: boolean;
}) {
  return (
    <button
      data-toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        fontFamily: "DM Mono, monospace",
        fontSize: 12,
        fontWeight: bold ? 900 : 400,
        fontStyle: italic ? "italic" : undefined,
        color: disabled ? "var(--stage-ultra-faint)" : "#999",
        background: "transparent",
        border: "1px solid var(--stage-border-subtle)",
        borderRadius: 4,
        padding: "4px 10px",
        cursor: disabled ? "default" : "pointer",
        lineHeight: 1.4,
        opacity: disabled ? 0.5 : 1,
      }}
      className="hover:bg-white/5 transition-colors"
    >
      {label}
    </button>
  );
}

// ---- Add Scene Form ----

function AddSceneForm({
  newAct, setNewAct, newSceneNum, setNewSceneNum, newSceneTitle, setNewSceneTitle,
  sceneSaving, scriptTextSize, onSubmit, onCancel,
}: {
  newAct: string; setNewAct: (v: string) => void;
  newSceneNum: string; setNewSceneNum: (v: string) => void;
  newSceneTitle: string; setNewSceneTitle: (v: string) => void;
  sceneSaving: boolean; scriptTextSize: number;
  onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div
      className="p-4 rounded-lg space-y-3"
      style={{ background: "var(--stage-line-hover)", border: "1px solid var(--stage-border)" }}
    >
      <div
        style={{
          fontFamily: "DM Mono, monospace",
          fontSize: Math.round(scriptTextSize * 0.55),
          color: "var(--stage-muted)",
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
        }}
      >
        New Scene
      </div>
      <div className="flex gap-3">
        <div style={{ width: 80 }}>
          <label className="block mb-1" style={{ fontFamily: "DM Mono, monospace", fontSize: Math.round(scriptTextSize * 0.5), color: "var(--stage-muted)" }}>Act</label>
          <input type="number" min={0} value={newAct} onChange={(e) => setNewAct(e.target.value)}
            className="w-full px-3 py-2 rounded"
            style={{ fontFamily: "DM Mono, monospace", fontSize: scriptTextSize, background: "var(--stage-bg)", border: "1px solid var(--stage-border)", color: "var(--stage-text)", outline: "none" }}
          />
        </div>
        <div style={{ width: 80 }}>
          <label className="block mb-1" style={{ fontFamily: "DM Mono, monospace", fontSize: Math.round(scriptTextSize * 0.5), color: "var(--stage-muted)" }}>Scene</label>
          <input type="number" min={0} value={newSceneNum} onChange={(e) => setNewSceneNum(e.target.value)}
            className="w-full px-3 py-2 rounded"
            style={{ fontFamily: "DM Mono, monospace", fontSize: scriptTextSize, background: "var(--stage-bg)", border: "1px solid var(--stage-border)", color: "var(--stage-text)", outline: "none" }}
          />
        </div>
        <div className="flex-1">
          <label className="block mb-1" style={{ fontFamily: "DM Mono, monospace", fontSize: Math.round(scriptTextSize * 0.5), color: "var(--stage-muted)" }}>Title</label>
          <input type="text" value={newSceneTitle} onChange={(e) => setNewSceneTitle(e.target.value)}
            placeholder="e.g. The Arrival"
            className="w-full px-3 py-2 rounded"
            style={{ fontFamily: "DM Mono, monospace", fontSize: scriptTextSize, background: "var(--stage-bg)", border: "1px solid var(--stage-border)", color: "var(--stage-text)", outline: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSubmit(); } }}
            autoFocus
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded transition-colors hover:bg-white/5"
          style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "var(--stage-muted)", border: "1px solid var(--stage-border-subtle)" }}>
          Cancel
        </button>
        <button onClick={onSubmit} disabled={sceneSaving || !newSceneTitle.trim()}
          className="px-3 py-1.5 rounded transition-colors"
          style={{ fontFamily: "DM Mono, monospace", fontSize: 11, fontWeight: 600, color: "var(--stage-gold)", background: "#E8C54715", border: "1px solid #E8C54740", opacity: sceneSaving || !newSceneTitle.trim() ? 0.5 : 1 }}>
          {sceneSaving ? "Creating..." : "Add Scene"}
        </button>
      </div>
    </div>
  );
}

export function scrollToLine(lineId: string, lineRefs: Record<string, HTMLDivElement | null>) {
  const el = lineRefs[lineId];
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
