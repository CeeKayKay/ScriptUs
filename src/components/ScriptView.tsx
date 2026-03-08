"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import * as Y from "yjs";
import { useStageStore } from "@/lib/store";
import { ROLES } from "@/lib/roles";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ScriptLine } from "./ScriptLine";
import type { CueView, ScriptLineView, LineType, SceneView } from "@/types";

interface ScriptViewProps {
  broadcast?: (msg: any) => void;
  projectId?: string;
  updateCursor?: (lineId: string | null, field?: "text" | "character" | "title" | null) => void;
  yDoc?: Y.Doc | null;
  synced?: boolean;
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

/** Normalize text: collapse 2+ consecutive newlines to 1, trim each line, drop blanks */
function normalizeSceneText(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l !== "")
    .join("\n");
}

/** Extract clean text from a contentEditable div by walking top-level child nodes.
 *  Avoids innerText quirks that produce extra \n between <div> elements. */
function extractEditorText(el: HTMLDivElement): string {
  const lines: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const t = (child as HTMLElement).innerText ?? "";
      lines.push(t);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent ?? "";
      if (t.trim()) lines.push(t);
    }
  }
  return normalizeSceneText(lines.join("\n"));
}

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
  const text = normalizeSceneText(lines[0].text || "");
  if (!text) return "";
  return text
    .split("\n")
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

/** Check if a line starts with a character name prefix followed by dialogue text.
 *  Returns the character name portion or null. e.g. "JOHN Hello" → "JOHN" */
function extractCharacterPrefix(line: string): string | null {
  // Match ALL_CAPS word(s) at start, followed by a space and more text
  const match = line.match(/^([A-Z][A-Z\s\-'\.]+?)\s{2,}(.+)$/) ||
                line.match(/^([A-Z][A-Z\-'\.]+)\s(.+)$/);
  if (!match) return null;
  const name = match[1].trim();
  if (name.length === 0 || name.length >= 40) return null;
  if (["THE END", "BLACKOUT", "LIGHTS UP", "CURTAIN", "INTERMISSION", "PROLOGUE", "EPILOGUE", "ACT", "SCENE"].includes(name)) return null;
  if (!/^[A-Z][A-Z\s\-'\.]+$/.test(name)) return null;
  return name;
}

/** Convert plain text to HTML with character name detection (for Y.Text rendering) */
function textToHtml(text: string): string {
  if (!text) return "<div><br></div>";
  return text
    .split("\n")
    .map((line) => {
      if (!line) return "<div><br></div>";
      // Full line is a character name (standalone, no dialogue yet)
      if (isCharacterName(line)) {
        const c = escapeHtml(line.trim());
        return `<div data-character="${c}" style="${CHAR_NAME_STYLE}">${c}</div>`;
      }
      // Line starts with character name prefix followed by dialogue
      const charPrefix = extractCharacterPrefix(line);
      if (charPrefix) {
        const rest = line.substring(charPrefix.length);
        const c = escapeHtml(charPrefix);
        return `<div data-character="${c}"><span style="${CHAR_NAME_STYLE}">${c}</span>${escapeHtml(rest)}</div>`;
      }
      return `<div>${escapeHtml(line)}</div>`;
    })
    .join("");
}

/** Extract raw text from contentEditable by walking top-level child nodes */
function getRawEditorText(el: HTMLDivElement): string {
  const lines: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const htmlEl = child as HTMLElement;
      if (htmlEl.childNodes.length === 1 && htmlEl.firstChild?.nodeName === "BR") {
        lines.push("");
      } else if (htmlEl.childNodes.length === 0) {
        lines.push("");
      } else {
        lines.push(htmlEl.textContent ?? "");
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      lines.push(child.textContent ?? "");
    }
  }
  return lines.join("\n");
}

/** Compute minimal text diff (common prefix/suffix) for Y.Text operations */
function computeTextDiff(
  oldText: string,
  newText: string
): { index: number; deleteCount: number; insert: string } {
  let prefixLen = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > prefixLen && newEnd > prefixLen && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return {
    index: prefixLen,
    deleteCount: oldEnd - prefixLen,
    insert: newText.slice(prefixLen, newEnd),
  };
}

/** Adjust a cursor offset for a Y.Text change delta (retain/insert/delete ops) */
function adjustOffsetForDelta(cursorOffset: number, delta: any[]): number {
  let oldPos = 0;
  let shift = 0;
  for (const op of delta) {
    if (op.retain !== undefined) {
      oldPos += op.retain;
    } else if (op.insert !== undefined) {
      const insertLen = typeof op.insert === "string" ? op.insert.length : 1;
      if (oldPos <= cursorOffset) {
        shift += insertLen;
      }
      // insert doesn't advance oldPos (new content, not in old text)
    } else if (op.delete !== undefined) {
      const deleteStart = oldPos;
      const deleteEnd = oldPos + op.delete;
      if (deleteEnd <= cursorOffset) {
        shift -= op.delete;
      } else if (deleteStart < cursorOffset) {
        shift -= cursorOffset - deleteStart;
      }
      oldPos += op.delete;
    }
  }
  return Math.max(0, cursorOffset + shift);
}

/** Save cursor as div-index + local char offset (survives innerHTML rebuild) */
function saveDivCursorState(el: HTMLDivElement): { divIndex: number; offset: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return null;
  const children = Array.from(el.children);
  for (let i = 0; i < children.length; i++) {
    if (children[i].contains(sel.anchorNode!)) {
      const preRange = document.createRange();
      preRange.selectNodeContents(children[i]);
      preRange.setEnd(sel.anchorNode!, sel.anchorOffset);
      return { divIndex: i, offset: preRange.toString().length };
    }
  }
  return null;
}

/** Restore cursor from div-index + local offset */
function restoreDivCursorState(el: HTMLDivElement, state: { divIndex: number; offset: number }): void {
  const sel = window.getSelection();
  if (!sel) return;
  const children = Array.from(el.children);
  const divIndex = Math.min(state.divIndex, children.length - 1);
  if (divIndex < 0) return;
  const div = children[divIndex];
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (currentOffset + node.length >= state.offset) {
      const range = document.createRange();
      range.setStart(node, Math.min(state.offset - currentOffset, node.length));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    currentOffset += node.length;
  }
  const range = document.createRange();
  range.selectNodeContents(div);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Get cursor position as Y.Text character offset */
function getCursorTextOffset(el: HTMLDivElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return null;
  let textOffset = 0;
  const children = Array.from(el.children);
  for (let i = 0; i < children.length; i++) {
    if (i > 0) textOffset += 1; // \n between divs
    if (children[i].contains(sel.anchorNode!)) {
      const preRange = document.createRange();
      preRange.selectNodeContents(children[i]);
      preRange.setEnd(sel.anchorNode!, sel.anchorOffset);
      textOffset += preRange.toString().length;
      return textOffset;
    }
    textOffset += (children[i].textContent || "").length;
  }
  return textOffset;
}

/** Set cursor at a Y.Text character offset */
function setCursorTextOffset(el: HTMLDivElement, targetOffset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  let textOffset = 0;
  const children = Array.from(el.children);
  for (let i = 0; i < children.length; i++) {
    if (i > 0) textOffset += 1;
    const childText = children[i].textContent || "";
    if (textOffset + childText.length >= targetOffset || i === children.length - 1) {
      const localOffset = Math.max(0, targetOffset - textOffset);
      const walker = document.createTreeWalker(children[i], NodeFilter.SHOW_TEXT);
      let nodeOffset = 0;
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (nodeOffset + node.length >= localOffset) {
          const range = document.createRange();
          range.setStart(node, Math.min(localOffset - nodeOffset, node.length));
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        nodeOffset += node.length;
      }
      const range = document.createRange();
      range.selectNodeContents(children[i]);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    textOffset += childText.length;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ---- Main Component ----

export function ScriptView({ broadcast, projectId: projectIdProp, updateCursor, yDoc, synced: yjsSynced }: ScriptViewProps) {
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
  // Track cursor as text offset (survives DOM changes and focus/blur cycles)
  const lastCursorOffsetRef = useRef<{ sceneId: string; offset: number } | null>(null);

  // Save cursor position whenever selection changes inside a scene editor
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      for (const [sceneId, editor] of Object.entries(sceneEditorRefs.current)) {
        if (editor && editor.contains(range.commonAncestorContainer)) {
          lastEditorRangeRef.current = { sceneId, range: range.cloneRange() };
          const offset = getCursorTextOffset(editor);
          if (offset !== null) {
            lastCursorOffsetRef.current = { sceneId, offset };
          }
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

  const canWrite = activeRole === "WRITER";

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
          // Y.Text handles live sync — only broadcast for non-CRDT clients
          if (!yDoc) {
            broadcast?.({
              type: "line-update",
              sceneId,
              lineId: firstLine.id,
              updates: { text: content },
            });
          }

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

    // Read saved cursor offset BEFORE calling focus() (focus triggers selectionchange
    // which would overwrite the saved position with the default focus position)
    const savedOffset = lastCursorOffsetRef.current;
    const hasSavedCursor = savedOffset && savedOffset.sceneId === targetSceneId;

    // --- CRDT path: insert into Y.Text, let observer rebuild DOM ---
    if (yDoc) {
      const yText = yDoc.getText(`scene-${targetSceneId}`);
      const fullText = yText.toString();

      // Use saved cursor offset, fallback to end
      let offset = hasSavedCursor ? savedOffset.offset : yText.length;
      // Clamp to valid range
      offset = Math.min(offset, fullText.length);

      // Determine what's on the current line
      const lineStart = fullText.lastIndexOf("\n", offset - 1) + 1;
      const lineEnd = fullText.indexOf("\n", offset);
      const currentLine = fullText.substring(lineStart, lineEnd === -1 ? fullText.length : lineEnd);
      const isOnEmptyLine = currentLine.trim() === "";

      let insertText: string;
      let insertAt: number;

      if (isOnEmptyLine) {
        // Cursor is on an empty/blank line — insert character name right here
        insertText = `${character} `;
        insertAt = lineStart;
        // Delete the empty line's whitespace if any
        const emptyLen = currentLine.length;
        if (emptyLen > 0) {
          yDoc.transact(() => {
            yText.delete(lineStart, emptyLen);
            yText.insert(lineStart, insertText);
          }, "character-insert");
        } else {
          yDoc.transact(() => {
            yText.insert(insertAt, insertText);
          }, "character-insert");
        }
      } else {
        // Cursor is in a non-empty line — move to end of current line, add character below
        const endOfLine = lineEnd === -1 ? fullText.length : lineEnd;
        insertText = `\n${character} `;
        insertAt = endOfLine;
        yDoc.transact(() => {
          yText.insert(insertAt, insertText);
        }, "character-insert");
      }

      // Place cursor on the dialogue line (after character name + newline)
      const cursorPos = insertAt + insertText.length;

      // Focus and set cursor position
      editor.focus();
      // Small delay to let the observer reconcile the DOM first
      requestAnimationFrame(() => {
        if (editor && document.activeElement === editor) {
          setCursorTextOffset(editor, cursorPos);
        } else {
          editor.focus();
          setCursorTextOffset(editor, cursorPos);
        }
      });
      return;
    }

    // --- Fallback (no CRDT): DOM-based insertion ---
    editor.focus();

    // Restore saved cursor position
    const sel = window.getSelection();
    if (sel) {
      const saved = lastEditorRangeRef.current;
      if (saved && saved.sceneId === targetSceneId && editor.contains(saved.range.commonAncestorContainer)) {
        sel.removeAllRanges();
        sel.addRange(saved.range);
      } else if (sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    const range = sel?.getRangeAt(0);
    if (!range) return;

    // Walk up to find the direct child div of the editor
    let anchorBlock: Node | null = range.startContainer;
    while (anchorBlock && anchorBlock.parentNode !== editor) {
      anchorBlock = anchorBlock.parentNode;
    }

    const charDiv = document.createElement("div");
    charDiv.setAttribute("data-character", character);
    const charSpan = document.createElement("span");
    charSpan.setAttribute("style", CHAR_NAME_STYLE);
    charSpan.textContent = character;
    charDiv.appendChild(charSpan);
    // Add a space after the character name for dialogue typing
    const spaceNode = document.createTextNode(" ");
    charDiv.appendChild(spaceNode);

    const refNode = anchorBlock?.nextSibling ?? null;
    editor.insertBefore(charDiv, refNode);

    // Place cursor after the space, ready for dialogue
    const newRange = document.createRange();
    newRange.setStartAfter(spaceNode);
    newRange.collapse(true);
    sel!.removeAllRanges();
    sel!.addRange(newRange);

    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }, [pendingDialogue, yDoc, scenes, setPendingDialogue]);

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
        // Update Y.Text so CRDT propagates the undo
        if (yDoc) {
          const yText = yDoc.getText(`scene-${action.sceneId}`);
          yDoc.transact(() => {
            yText.delete(0, yText.length);
            if (data.text) yText.insert(0, data.text);
          }, "undo");
        } else {
          broadcast?.({
            type: "line-update",
            sceneId: action.sceneId,
            lineId: action.lineId,
            updates: { text: data.text, character: data.character },
          });
        }
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
  }, [projectId, yDoc, updateLine, updateSceneTitle, broadcast]);

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
                yDoc={yDoc ?? null}
                synced={yjsSynced ?? false}
                canEdit={canWrite}
                activeRole={activeRole}
                projectId={projectId || ""}
                scriptTextSize={scriptTextSize}
                isMobile={isMobile}
                onSave={(text) => handleSaveSceneContent(scene.id, text)}
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

// ---- Scene Text Box (CRDT-powered contentEditable) ----

function SceneTextBox({
  scene,
  yDoc,
  synced,
  canEdit,
  activeRole,
  projectId,
  scriptTextSize,
  isMobile,
  onSave,
  onFocus,
  onBlur,
  editorRef,
}: {
  scene: SceneView;
  yDoc: Y.Doc | null;
  synced: boolean;
  canEdit: boolean;
  activeRole: string;
  projectId: string;
  scriptTextSize: number;
  isMobile: boolean;
  onSave: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  editorRef: (el: HTMLDivElement | null) => void;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const lastTextRef = useRef<string>("");
  const yTextRef = useRef<Y.Text | null>(null);
  const initializedRef = useRef(false);
  const domInitializedRef = useRef(false);
  const isDirtyRef = useRef(false);
  // Store latest props in refs for stable ref callback
  const editorRefProp = useRef(editorRef);
  editorRefProp.current = editorRef;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  // Selection popup state
  const [selPopup, setSelPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const openCueEditor = useStageStore((s) => s.openCueEditor);
  const addComment = useStageStore((s) => s.addComment);

  // Determine cue button label based on role
  const cueButtonLabel = useMemo(() => {
    if (activeRole === "SET_DESIGN") return "+ Set";
    if (activeRole === "PROPS") return "+ Prop";
    const canCue = ["STAGE_MANAGER", "DIRECTOR", "ACTOR", "LIGHTING", "SOUND", "SET_DESIGN", "PROPS"].includes(activeRole);
    return canCue ? "+ Cue" : null;
  }, [activeRole]);
  const canComment = activeRole !== "VIEWER";

  // Track text selection inside editor
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelPopup(null);
        return;
      }
      if (!localRef.current || !localRef.current.contains(sel.anchorNode)) {
        setSelPopup(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) { setSelPopup(null); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const parentRect = localRef.current.getBoundingClientRect();
      setSelPopup({
        x: rect.left - parentRect.left + rect.width / 2,
        y: rect.top - parentRect.top - 36,
        text,
      });
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  const handleAddCue = useCallback(() => {
    if (!selPopup) return;
    const lineId = scene.lines[0]?.id || null;
    openCueEditor(undefined, lineId || undefined, scene.id, selPopup.text);
    setSelPopup(null);
  }, [selPopup, scene.id, scene.lines, openCueEditor]);

  const handleAddComment = useCallback(async () => {
    if (!selPopup || !projectId) return;
    const lineId = scene.lines[0]?.id;
    if (!lineId) return;
    const commentText = prompt("Add a comment:");
    if (!commentText?.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId,
          text: commentText.trim(),
          scriptRef: selPopup.text,
          role: activeRole,
        }),
      });
      if (res.ok) {
        const comment = await res.json();
        addComment(lineId, comment);
      }
    } catch {}
    setSelPopup(null);
  }, [selPopup, scene.lines, projectId, activeRole, addComment]);

  // Stable ref callback — must be at top level (not in JSX) to avoid hook order issues
  const editorDivRef = useCallback((el: HTMLDivElement | null) => {
    localRef.current = el;
    editorRefProp.current(el);
    if (!el) {
      // Editor unmounted (e.g. switched to read-only role) — reset so next mount re-initializes
      domInitializedRef.current = false;
      return;
    }
    if (!domInitializedRef.current) {
      domInitializedRef.current = true;
      const yt = yTextRef.current;
      if (yt && yt.length > 0) {
        const text = yt.toString();
        lastTextRef.current = text;
        el.innerHTML = textToHtml(text);
      } else {
        lastTextRef.current = linesToText(sceneRef.current.lines);
        el.innerHTML = sceneLinesToHtml(sceneRef.current.lines) || "<div><br></div>";
      }
    }
  }, []);

  // Remote cursor indicators for this scene
  const remoteCursors = useStageStore((s) => s.remoteCursors).filter((c) =>
    scene.lines.some((l) => l.id === c.lineId)
  );

  // DB-based fallback HTML (before Y.Text is ready)
  const fallbackHtml = useMemo(
    () => sceneLinesToHtml(scene.lines) || "<div><br></div>",
    [scene.lines]
  );

  // Read-only display HTML (updated by Y.Text observer)
  const [displayHtml, setDisplayHtml] = useState(fallbackHtml);

  // Get Y.Text for this scene
  const yText = useMemo(
    () => yDoc?.getText(`scene-${scene.id}`) ?? null,
    [yDoc, scene.id]
  );
  yTextRef.current = yText;

  // Initialize Y.Text from DB + set up observer
  useEffect(() => {
    if (!yText || !yDoc || !synced) return;

    // Initialize from DB if Y.Text is empty (first user to connect)
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (yText.length === 0 && scene.lines.length > 0) {
        const dbText = normalizeSceneText(linesToText(scene.lines));
        if (dbText) {
          yDoc.transact(() => {
            yText.insert(0, dbText);
          }, "init");
        }
      }
      // Set initial DOM
      const text = yText.toString();
      lastTextRef.current = text;
      const html = textToHtml(text);
      setDisplayHtml(html);
      if (localRef.current && document.activeElement !== localRef.current) {
        localRef.current.innerHTML = html;
      }
    }

    // Observer for remote + programmatic changes (character insert, undo)
    const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      // Skip DOM updates for normal typing (DOM already reflects local input)
      if (transaction.local && transaction.origin === "input") return;

      const newText = yText.toString();
      lastTextRef.current = newText;
      const newHtml = textToHtml(newText);
      setDisplayHtml(newHtml); // For read-only mode

      if (!localRef.current) return;

      const isFocused = document.activeElement === localRef.current;

      if (!isFocused) {
        // Not focused — safe to do full rebuild
        localRef.current.innerHTML = newHtml;
        return;
      }

      // --- Focused: reconcile DOM at line level to preserve cursor ---
      // Split new text into lines and build target divs
      const newLines = newText.split("\n");
      const editor = localRef.current;
      const oldChildren = Array.from(editor.children) as HTMLElement[];

      // Helper: build correct innerHTML for a line
      const buildLineHtml = (line: string): string => {
        if (!line) return "<br>";
        if (isCharacterName(line)) {
          const c = escapeHtml(line.trim());
          return `<span style="${CHAR_NAME_STYLE}">${c}</span>`;
        }
        const charPrefix = extractCharacterPrefix(line);
        if (charPrefix) {
          const rest = line.substring(charPrefix.length);
          return `<span style="${CHAR_NAME_STYLE}">${escapeHtml(charPrefix)}</span>${escapeHtml(rest)}`;
        }
        return escapeHtml(line);
      };

      // Reconcile: update changed lines, add/remove as needed
      for (let i = 0; i < Math.max(newLines.length, oldChildren.length); i++) {
        if (i >= newLines.length) {
          // Remove extra old children
          while (editor.children.length > newLines.length) {
            editor.removeChild(editor.lastChild!);
          }
          break;
        }

        const line = newLines[i];
        const expectedText = line || "";

        if (i < oldChildren.length) {
          const oldEl = oldChildren[i];
          const oldText = oldEl.textContent || "";

          if (oldText !== expectedText) {
            // Check if cursor is inside this child
            const sel = window.getSelection();
            const cursorInThisChild = sel && sel.rangeCount > 0 && oldEl.contains(sel.anchorNode);

            if (!cursorInThisChild) {
              // Safe to fully replace content
              const charPrefix = extractCharacterPrefix(expectedText);
              if (isCharacterName(expectedText)) {
                oldEl.setAttribute("data-character", escapeHtml(expectedText.trim()));
              } else if (charPrefix) {
                oldEl.setAttribute("data-character", escapeHtml(charPrefix));
              } else {
                oldEl.removeAttribute("data-character");
              }
              oldEl.removeAttribute("style");
              oldEl.innerHTML = buildLineHtml(expectedText);
            }
            // If cursor IS in this child, leave it alone — user is typing here
          }
        } else {
          // Append new child
          const div = document.createElement("div");
          const charPrefix = extractCharacterPrefix(expectedText);
          if (isCharacterName(expectedText)) {
            div.setAttribute("data-character", escapeHtml(expectedText.trim()));
          } else if (charPrefix) {
            div.setAttribute("data-character", escapeHtml(charPrefix));
          }
          div.innerHTML = buildLineHtml(expectedText);
          editor.appendChild(div);
        }
      }
    };

    yText.observe(observer);
    return () => yText.unobserve(observer);
  }, [yText, yDoc, synced, scene.lines]);

  // Handle local input: compute diff and apply to Y.Text
  const handleInput = useCallback(() => {
    isDirtyRef.current = true;
    if (!localRef.current || !yTextRef.current || !yDoc) return;

    const newText = getRawEditorText(localRef.current);
    const oldText = lastTextRef.current;
    if (newText === oldText) return;

    const diff = computeTextDiff(oldText, newText);
    yDoc.transact(() => {
      if (diff.deleteCount > 0) yTextRef.current!.delete(diff.index, diff.deleteCount);
      if (diff.insert) yTextRef.current!.insert(diff.index, diff.insert);
    }, "input");

    lastTextRef.current = yTextRef.current.toString();
  }, [yDoc]);

  // Save Y.Text to DB on blur
  const handleBlur = useCallback(() => {
    if (isDirtyRef.current) {
      isDirtyRef.current = false;
      const text = yTextRef.current
        ? normalizeSceneText(yTextRef.current.toString())
        : localRef.current
          ? extractEditorText(localRef.current)
          : "";
      if (text) onSave(text);
    }
    onBlur();
  }, [onSave, onBlur]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  // Selection popup element (shared between editable and read-only)
  const selectionPopupEl = selPopup && (cueButtonLabel || canComment) ? (
    <div
      data-toolbar
      style={{
        position: "absolute",
        left: selPopup.x,
        top: selPopup.y,
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "flex",
        gap: 4,
        background: "var(--stage-surface)",
        border: "1px solid var(--stage-border)",
        borderRadius: 6,
        padding: "4px 6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        whiteSpace: "nowrap",
      }}
    >
      {cueButtonLabel && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleAddCue}
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--stage-gold)",
            background: "#E8C54715",
            border: "1px solid #E8C54740",
            borderRadius: 4,
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          {cueButtonLabel}
        </button>
      )}
      {canComment && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleAddComment}
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            fontWeight: 600,
            color: "#47B8E8",
            background: "#47B8E815",
            border: "1px solid #47B8E840",
            borderRadius: 4,
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          + Comment
        </button>
      )}
    </div>
  ) : null;

  // For read-only: set innerHTML imperatively via ref so React re-renders
  // (from selection popup state changes) don't destroy in-progress text selection
  const readOnlyRef = useCallback((el: HTMLDivElement | null) => {
    localRef.current = el;
    if (el) {
      el.innerHTML = displayHtml || '<span style="color:var(--stage-faint);font-style:italic;">No content yet</span>';
    }
  }, [displayHtml]);

  if (!canEdit) {
    return (
      <div style={{ position: "relative" }}>
        {remoteCursors.length > 0 && (
          <div style={{ position: "absolute", top: -2, right: 8, zIndex: 5 }}>
            <RemoteCursorIndicator cursors={remoteCursors} />
          </div>
        )}
        {selectionPopupEl}
        <div
          ref={readOnlyRef}
          style={{
            fontFamily: "Libre Baskerville, serif",
            fontSize: scriptTextSize,
            color: "var(--stage-text)",
            lineHeight: 1.75,
            padding: isMobile ? "8px" : "8px 16px",
            minHeight: 60,
            userSelect: "text",
            cursor: "text",
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
      {selectionPopupEl}
      <div
        ref={editorDivRef}
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
          // Don't blur if clicking toolbar or selection popup
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
