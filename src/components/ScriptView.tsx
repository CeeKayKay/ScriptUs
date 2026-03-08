"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import * as Y from "yjs";
import { useStageStore } from "@/lib/store";
import { ROLES } from "@/lib/roles";
import { CUE_TYPES } from "@/lib/cue-types";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ScriptLine } from "./ScriptLine";
import type { CueView, ScriptLineView, LineType, SceneView, CueType } from "@/types";

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
  // Match ALL_CAPS word(s) at start, followed by a space and optional text
  const match = line.match(/^([A-Z][A-Z\s\-'\.]+?)\s{2,}(.+)$/) ||
                line.match(/^([A-Z][A-Z\-'\.]+)\s(.*)$/);
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
      // Line starts with character name prefix followed by dialogue (or just a space for cursor)
      const charPrefix = extractCharacterPrefix(line);
      if (charPrefix) {
        const rest = line.substring(charPrefix.length);
        const c = escapeHtml(charPrefix);
        return `<div data-character="${c}"><span style="${CHAR_NAME_STYLE}">${c}</span>${escapeHtml(rest)}</div>`;
      }
      // Full line is a character name (standalone, no trailing space)
      if (isCharacterName(line)) {
        const trimmed = line.trim();
        const c = escapeHtml(trimmed);
        // If line has trailing space (cursor placeholder), render as inline prefix
        if (line.length > trimmed.length) {
          const rest = line.substring(trimmed.length);
          return `<div data-character="${c}"><span style="${CHAR_NAME_STYLE}">${c}</span>${escapeHtml(rest)}</div>`;
        }
        return `<div data-character="${c}" style="${CHAR_NAME_STYLE}">${c}</div>`;
      }
      return `<div>${escapeHtml(line)}</div>`;
    })
    .join("");
}

/** Build annotated line content with cue badges and/or comment underlines.
 *  sideBubbleDir: when set, cue labels render as side bubbles anchored to the
 *  line div edge with a connecting line, instead of floating badges above text. */
function annotateLine(
  plainText: string,
  cues: CueView[],
  selectedCommentRef: string | null,
  sideBubbleDir: "left" | "right" | null = null,
): string {
  type Ann = { start: number; end: number; type: "cue" | "comment"; cue?: CueView; color?: string };
  const anns: Ann[] = [];

  for (const cue of cues) {
    if (!cue.scriptRef) continue;
    const idx = plainText.indexOf(cue.scriptRef);
    if (idx !== -1) {
      const config = CUE_TYPES[cue.type];
      anns.push({ start: idx, end: idx + cue.scriptRef.length, type: "cue", cue, color: config?.color || "#888" });
    }
  }

  if (selectedCommentRef) {
    const idx = plainText.indexOf(selectedCommentRef);
    if (idx !== -1) {
      anns.push({ start: idx, end: idx + selectedCommentRef.length, type: "comment" });
    }
  }

  if (anns.length === 0) return "";

  anns.sort((a, b) => a.start - b.start);

  // Collect side-bubble data to render at div edge after the text
  const sideBubbles: { id: string; pillStyle: string; bubbleLabel: string; color: string }[] = [];

  let result = "";
  let pos = 0;
  for (const ann of anns) {
    if (ann.start > pos) result += escapeHtml(plainText.substring(pos, ann.start));
    const segText = escapeHtml(plainText.substring(ann.start, ann.end));
    if (ann.type === "cue" && ann.cue) {
      const config = CUE_TYPES[ann.cue.type];
      if (sideBubbleDir) {
        // Side-bubble mode: highlighted text gets underline + background only
        result += `<span data-cue-highlight="${ann.cue.id}" style="background:${ann.color}15;border-bottom:2px solid #47B8E8;padding:1px 0;border-radius:2px;">${segText}</span>`;

        // Bubble is collected and rendered at the div edge (appended after text)
        const bubbleLabel = escapeHtml(ann.cue.label);
        const pillStyle = `font-family:DM Mono,monospace;font-size:20px;font-weight:700;color:${ann.color};background:${config?.bgColor || ann.color + '15'};border:1px solid ${config?.borderColor || ann.color + '30'};border-radius:12px;padding:2px 10px;white-space:nowrap;line-height:1.3;`;
        sideBubbles.push({ id: ann.cue.id, pillStyle, bubbleLabel, color: ann.color || "#888" });
      } else {
        // Default top-badge mode
        result += `<span style="position:relative;display:inline;background:${ann.color}20;border-bottom:2px solid ${ann.color};padding:1px 0;border-radius:2px;">`;
        result += `<span contenteditable="false" style="position:absolute;top:-1.5em;left:0;font-family:DM Mono,monospace;font-size:9px;font-weight:700;color:${ann.color};background:${config?.bgColor || ann.color + '15'};border:1px solid ${config?.borderColor || ann.color + '30'};border-radius:3px;padding:0 4px;white-space:nowrap;pointer-events:auto;cursor:pointer;line-height:1.4;" data-cue-id="${ann.cue.id}">${escapeHtml(ann.cue.label)}</span>`;
        result += segText;
        result += `</span>`;
      }
    } else if (ann.type === "comment") {
      result += `<span style="text-decoration:underline;text-decoration-color:#47B8E8;text-underline-offset:3px;text-decoration-thickness:2px;background:#47B8E810;border-radius:2px;padding:1px 0;">${segText}</span>`;
    }
    pos = ann.end;
  }
  if (pos < plainText.length) result += escapeHtml(plainText.substring(pos));

  // Append side-bubble elements positioned outside the div edge
  // aligned to bottom (underline level) with a connecting line
  for (let i = 0; i < sideBubbles.length; i++) {
    const sb = sideBubbles[i];
    const topOffset = i * 28;
    // Line connects at the bottom (underline level) via align-items:flex-end
    // Bubble offset ~50% into the margin gap (40px gap + pill)
    if (sideBubbleDir === "left") {
      result += `<span contenteditable="false" data-cue-id="${sb.id}" style="position:absolute;left:-40px;top:${topOffset}px;height:100%;transform:translateX(-100%);display:flex;align-items:flex-end;white-space:nowrap;pointer-events:auto;cursor:pointer;">`;
      result += `<span style="${sb.pillStyle}">${sb.bubbleLabel}</span>`;
      result += `<span style="display:inline-block;width:40px;height:0;border-top:2px solid #47B8E8;flex-shrink:0;margin-bottom:1px;"></span>`;
      result += `</span>`;
    } else {
      result += `<span contenteditable="false" data-cue-id="${sb.id}" style="position:absolute;right:-40px;top:${topOffset}px;height:100%;transform:translateX(100%);display:flex;align-items:flex-end;white-space:nowrap;pointer-events:auto;cursor:pointer;">`;
      result += `<span style="display:inline-block;width:40px;height:0;border-top:2px solid #47B8E8;flex-shrink:0;margin-bottom:1px;"></span>`;
      result += `<span style="${sb.pillStyle}">${sb.bubbleLabel}</span>`;
      result += `</span>`;
    }
  }

  return result;
}

/** Convert plain text to display HTML with cue badges and comment underlines */
function textToDisplayHtml(
  text: string,
  cues: CueView[],
  visibleCueTypes: CueType[],
  selectedCommentRef: string | null,
  sideBubbleDir: "left" | "right" | null = null,
): string {
  if (!text) return "<div><br></div>";

  const activeCues = cues.filter((c) => c.scriptRef && visibleCueTypes.includes(c.type));

  return text
    .split("\n")
    .map((line) => {
      if (!line) return "<div><br></div>";

      // Check for annotations on this line
      const annotated = annotateLine(line, activeCues, selectedCommentRef, sideBubbleDir);
      const hasCueBadge = activeCues.some((c) => c.scriptRef && line.includes(c.scriptRef));
      // Top-badge mode needs padding-top; side-bubble mode needs overflow visible
      const padStyle = hasCueBadge
        ? (sideBubbleDir
          ? ` style="position:relative;overflow:visible;"`
          : ` style="position:relative;padding-top:1.8em;"`)
        : "";

      if (annotated) {
        const charPrefix = extractCharacterPrefix(line);
        if (charPrefix) {
          const c = escapeHtml(charPrefix);
          // Re-annotate only the dialogue portion after the prefix
          const dialoguePart = line.substring(charPrefix.length);
          const dialogueAnnotated = annotateLine(dialoguePart, activeCues, selectedCommentRef, sideBubbleDir);
          const dialogueHtml = dialogueAnnotated || escapeHtml(dialoguePart);
          return `<div data-character="${c}"${padStyle}><span style="${CHAR_NAME_STYLE}">${c}</span>${dialogueHtml}</div>`;
        }
        if (isCharacterName(line)) {
          const trimmed = line.trim();
          const c = escapeHtml(trimmed);
          return `<div data-character="${c}" style="${CHAR_NAME_STYLE}">${c}</div>`;
        }
        return `<div${padStyle}>${annotated}</div>`;
      }

      // No annotations — use standard textToHtml logic
      const charPrefix = extractCharacterPrefix(line);
      if (charPrefix) {
        const rest = line.substring(charPrefix.length);
        const c = escapeHtml(charPrefix);
        return `<div data-character="${c}"><span style="${CHAR_NAME_STYLE}">${c}</span>${escapeHtml(rest)}</div>`;
      }
      if (isCharacterName(line)) {
        const trimmed = line.trim();
        const c = escapeHtml(trimmed);
        if (line.length > trimmed.length) {
          const rest = line.substring(trimmed.length);
          return `<div data-character="${c}"><span style="${CHAR_NAME_STYLE}">${c}</span>${escapeHtml(rest)}</div>`;
        }
        return `<div data-character="${c}" style="${CHAR_NAME_STYLE}">${c}</div>`;
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
    isCuePanelOpen,
    toggleCuePanel,
    isCommentPanelOpen,
    toggleCommentPanel,
    cuePanelSide,
  } = useStageStore();

  const projectId = projectIdProp || storeProjectId;
  const containerRef = useRef<HTMLDivElement>(null);
  const roleConfig = ROLES[activeRole];
  const isMobile = useIsMobile();

  // Side-bubble cue overlay for Lighting, Sound, Stage Manager
  const SIDE_BUBBLE_ROLES = ["LIGHTING", "SOUND", "STAGE_MANAGER"];
  const sideBubbleDir: "left" | "right" | null = SIDE_BUBBLE_ROLES.includes(activeRole)
    ? (cuePanelSide === "left" ? "left" : "right")
    : null;

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

  // Formatting keyboard shortcuts (Tab for indent, Shift+Tab for outdent)
  useEffect(() => {
    if (!canWrite) return;
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement;
      if (!active?.isContentEditable) return;

      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          document.execCommand("outdent", false);
        } else {
          document.execCommand("indent", false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canWrite]);

  // Toolbar formatting helpers
  const applyBold = useCallback(() => {
    document.execCommand("bold", false);
  }, []);

  const applyItalic = useCallback(() => {
    document.execCommand("italic", false);
  }, []);

  const applyBulletList = useCallback(() => {
    document.execCommand("insertUnorderedList", false);
  }, []);

  const applyNumberedList = useCallback(() => {
    document.execCommand("insertOrderedList", false);
  }, []);

  const applyIndent = useCallback(() => {
    document.execCommand("indent", false);
  }, []);

  const applyOutdent = useCallback(() => {
    document.execCommand("outdent", false);
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
      style={{
        padding: isMobile
          ? "0 8px 80px"
          : sideBubbleDir === "left"
            ? "0 32px 80px 160px"
            : sideBubbleDir === "right"
              ? "0 160px 80px 32px"
              : "0 32px 80px",
      }}
    >
      {/* Panel toggle buttons at top of script area */}
      {((!roleConfig.hasCuePanel || !isCuePanelOpen) || (activeRole !== "VIEWER" && !isCommentPanelOpen)) && (() => {
        const cueBtnOnLeft = cuePanelSide === "left";
        const panelLabels: Record<string, [string, string]> = {
          WRITER: ["Characters & Settings", "EDIT"],
          PROPS: ["Props List", "PROPS"],
          SET_DESIGN: ["Set Design List", "SET"],
          SOUND: ["Sound Cue Sheet", "SOUND"],
          LIGHTING: ["Lighting Cue Sheet", "LX"],
          ACTOR: ["Blocking Notes", "BLOCK"],
          DIRECTOR: ["Technical Cues", "CUES"],
          STAGE_MANAGER: ["Technical Cues", "CUES"],
        };
        const [panelLabel, panelLabelShort] = panelLabels[activeRole] || ["Cue Sheet", "CUE"];
        const cueBtn = roleConfig.hasCuePanel && !isCuePanelOpen && (
          <button
            onClick={toggleCuePanel}
            style={{
              height: 32,
              borderRadius: 6,
              background: activeRole === "WRITER" ? "var(--stage-gold-bg)"
                : (activeRole === "ACTOR" || activeRole === "DIRECTOR") ? "var(--stage-hover)" : roleConfig.color + "20",
              border: activeRole === "WRITER" ? "1px solid var(--stage-gold-border)"
                : (activeRole === "ACTOR" || activeRole === "DIRECTOR") ? "1px solid var(--stage-border)" : `1px solid ${roleConfig.color}60`,
              color: activeRole === "WRITER" ? "var(--stage-gold)"
                : (activeRole === "ACTOR" || activeRole === "DIRECTOR") ? "var(--stage-text)" : roleConfig.color,
              fontFamily: "DM Mono, monospace",
              fontSize: Math.round(scriptTextSize * 0.75),
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 10px",
              gap: 4,
              cursor: "pointer",
            }}
            title={`Open ${panelLabel}`}
          >
            {roleConfig.icon} {isMobile ? panelLabelShort : panelLabel}
          </button>
        );
        const commentBtn = activeRole !== "VIEWER" && !isCommentPanelOpen && (
          <button
            onClick={toggleCommentPanel}
            style={{
              height: 32,
              borderRadius: 6,
              background: "#47B8E820",
              border: "1px solid #47B8E860",
              color: "#47B8E8",
              fontFamily: "DM Mono, monospace",
              fontSize: isMobile ? 10 : 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 10px",
              gap: 4,
              cursor: "pointer",
            }}
            title="Open Comments"
          >
            Comments
          </button>
        );
        const leftBtn = cueBtnOnLeft ? cueBtn : commentBtn;
        const rightBtn = cueBtnOnLeft ? commentBtn : cueBtn;
        return (
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5"
            style={{
              background: "var(--stage-bg)",
              borderBottom: "1px solid var(--stage-hover)",
            }}
          >
            <div>{leftBtn}</div>
            <div>{rightBtn}</div>
          </div>
        );
      })()}

      {/* Sticky toolbar */}
      {canWrite && (
        <div
          className="sticky top-0 z-10 flex items-center justify-center gap-1 py-2 px-1 flex-wrap"
          style={{
            background: "var(--stage-bg)",
            borderBottom: "1px solid var(--stage-hover)",
          }}
        >
          <ToolbarButton
            label="B"
            title="Bold (Ctrl+B)"
            bold
            onClick={applyBold}
          />
          <ToolbarButton
            label="I"
            title="Italic (Ctrl+I)"
            italic
            onClick={applyItalic}
          />
          <div style={{ width: 1, height: 18, background: "var(--stage-border)", margin: "0 2px" }} />
          <ToolbarButton
            label="• List"
            title="Bullet list"
            onClick={applyBulletList}
          />
          <ToolbarButton
            label="1. List"
            title="Numbered list"
            onClick={applyNumberedList}
          />
          <div style={{ width: 1, height: 18, background: "var(--stage-border)", margin: "0 2px" }} />
          <ToolbarButton
            label="→ Indent"
            title="Indent (Tab)"
            onClick={applyIndent}
          />
          <ToolbarButton
            label="← Outdent"
            title="Outdent (Shift+Tab)"
            onClick={applyOutdent}
          />
          <div style={{ width: 1, height: 18, background: "var(--stage-border)", margin: "0 2px" }} />
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
                sideBubbleDir={sideBubbleDir}
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
  sideBubbleDir,
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
  sideBubbleDir: "left" | "right" | null;
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
  // Inline comment input state
  const [commentInput, setCommentInput] = useState<{ x: number; y: number; scriptRef: string } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
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

  const handleAddComment = useCallback(() => {
    if (!selPopup) return;
    // Show inline comment input at the selection popup position
    setCommentInput({ x: selPopup.x, y: selPopup.y + 40, scriptRef: selPopup.text });
    setCommentText("");
    setSelPopup(null);
  }, [selPopup]);

  const handleSubmitComment = useCallback(async () => {
    if (!commentInput || !commentText.trim() || !projectId) return;
    const lineId = scene.lines[0]?.id;
    if (!lineId) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineId,
          text: commentText.trim(),
          scriptRef: commentInput.scriptRef,
          role: activeRole,
        }),
      });
      if (res.ok) {
        const comment = await res.json();
        addComment(lineId, comment);
      }
    } catch {}
    setCommentSubmitting(false);
    setCommentInput(null);
    setCommentText("");
  }, [commentInput, commentText, scene.lines, projectId, activeRole, addComment]);

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

  const selectedCommentRef = useStageStore((s) => s.selectedCommentRef);

  // Highlight selected comment's scriptRef in editable mode
  useEffect(() => {
    const editor = localRef.current;
    if (!editor || !canEdit) return;

    // Remove previous highlights
    const existing = editor.querySelectorAll("mark[data-comment-highlight]");
    existing.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });

    if (!selectedCommentRef) return;

    // Walk text nodes and wrap matches
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const matches: { node: Text; start: number; end: number }[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent || "";
      const idx = text.indexOf(selectedCommentRef);
      if (idx !== -1) {
        matches.push({ node, start: idx, end: idx + selectedCommentRef.length });
      }
    }

    for (const m of matches) {
      const { node: textNode, start, end } = m;
      const before = textNode.textContent!.substring(0, start);
      const matched = textNode.textContent!.substring(start, end);
      const after = textNode.textContent!.substring(end);
      const parent = textNode.parentNode!;

      const mark = document.createElement("mark");
      mark.setAttribute("data-comment-highlight", "true");
      mark.style.textDecoration = "underline";
      mark.style.textDecorationColor = "#47B8E8";
      mark.style.textUnderlineOffset = "3px";
      mark.style.textDecorationThickness = "2px";
      mark.style.background = "rgba(71,184,232,0.06)";
      mark.style.borderRadius = "2px";
      mark.textContent = matched;

      if (before) parent.insertBefore(document.createTextNode(before), textNode);
      parent.insertBefore(mark, textNode);
      if (after) parent.insertBefore(document.createTextNode(after), textNode);
      parent.removeChild(textNode);
    }
  }, [selectedCommentRef, canEdit]);

  // DB-based fallback HTML (before Y.Text is ready)
  const fallbackHtml = useMemo(
    () => sceneLinesToHtml(scene.lines) || "<div><br></div>",
    [scene.lines]
  );

  // Read-only display HTML (updated by Y.Text observer)
  const [displayHtml, setDisplayHtml] = useState(fallbackHtml);
  // Raw text for annotation overlay (cues + comment underlines)
  const [rawText, setRawText] = useState("");
  const roleConfig = ROLES[activeRole as keyof typeof ROLES];

  // All cues in this scene
  const sceneCues = useMemo(
    () => scene.lines.flatMap((l) => l.cues || []),
    [scene.lines]
  );

  // Compute annotated display HTML for read-only mode
  const annotatedDisplayHtml = useMemo(() => {
    if (!rawText && !sceneCues.length && !selectedCommentRef) return displayHtml;
    const text = rawText || "";
    if (!text) return displayHtml;
    const visibleTypes = (roleConfig?.visibleCueTypes || []) as CueType[];
    const hasAnnotations =
      sceneCues.some((c) => c.scriptRef && visibleTypes.includes(c.type) && text.includes(c.scriptRef)) ||
      (selectedCommentRef && text.includes(selectedCommentRef));
    if (!hasAnnotations) return displayHtml;
    return textToDisplayHtml(text, sceneCues, visibleTypes, selectedCommentRef, sideBubbleDir);
  }, [rawText, displayHtml, sceneCues, selectedCommentRef, roleConfig, sideBubbleDir]);

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
      setRawText(text);
      const html = textToHtml(text);
      setDisplayHtml(html);
      if (localRef.current && document.activeElement !== localRef.current) {
        localRef.current.innerHTML = html;
      }
    }

    // Observer for remote + programmatic changes (character insert, undo)
    const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      const newText = yText.toString();
      lastTextRef.current = newText;
      // Always keep display state in sync (read-only views depend on this)
      setRawText(newText);
      const newHtml = textToHtml(newText);
      setDisplayHtml(newHtml);

      // Skip DOM updates for normal typing (DOM already reflects local input)
      if (transaction.local && transaction.origin === "input") return;

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
        const charPrefix = extractCharacterPrefix(line);
        if (charPrefix) {
          const rest = line.substring(charPrefix.length);
          return `<span style="${CHAR_NAME_STYLE}">${escapeHtml(charPrefix)}</span>${escapeHtml(rest)}`;
        }
        if (isCharacterName(line)) {
          const trimmed = line.trim();
          const c = escapeHtml(trimmed);
          if (line.length > trimmed.length) {
            const rest = line.substring(trimmed.length);
            return `<span style="${CHAR_NAME_STYLE}">${c}</span>${escapeHtml(rest)}`;
          }
          return `<span style="${CHAR_NAME_STYLE}">${c}</span>`;
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

  // Inline comment input popup
  const commentInputEl = commentInput ? (
    <div
      data-toolbar
      style={{
        position: "absolute",
        left: Math.max(20, Math.min(commentInput.x, 280)),
        top: commentInput.y,
        transform: "translateX(-50%)",
        zIndex: 25,
        background: "var(--stage-surface)",
        border: "1px solid #47B8E840",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        width: isMobile ? 240 : 280,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#47B8E8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
        Comment
      </div>
      {commentInput.scriptRef && (
        <div style={{
          fontFamily: "Libre Baskerville, serif",
          fontSize: 11,
          color: "var(--stage-muted)",
          fontStyle: "italic",
          padding: "4px 8px",
          marginBottom: 6,
          background: "#47B8E808",
          borderLeft: "2px solid #47B8E840",
          borderRadius: 2,
          whiteSpace: "pre-wrap",
          maxHeight: 40,
          overflow: "hidden",
        }}>
          &ldquo;{commentInput.scriptRef}&rdquo;
        </div>
      )}
      <textarea
        autoFocus
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); }
          if (e.key === "Escape") { setCommentInput(null); setCommentText(""); }
        }}
        placeholder="Type your comment..."
        rows={2}
        style={{
          width: "100%",
          fontFamily: "DM Mono, monospace",
          fontSize: 12,
          color: "var(--stage-text)",
          background: "var(--stage-bg)",
          border: "1px solid var(--stage-border)",
          borderRadius: 4,
          padding: "6px 8px",
          outline: "none",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
        <button
          onClick={() => { setCommentInput(null); setCommentText(""); }}
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            color: "var(--stage-muted)",
            background: "none",
            border: "1px solid var(--stage-border-subtle)",
            borderRadius: 4,
            padding: "3px 10px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmitComment}
          disabled={commentSubmitting || !commentText.trim()}
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 11,
            fontWeight: 600,
            color: "#47B8E8",
            background: "#47B8E815",
            border: "1px solid #47B8E840",
            borderRadius: 4,
            padding: "3px 10px",
            cursor: "pointer",
            opacity: commentSubmitting || !commentText.trim() ? 0.5 : 1,
          }}
        >
          {commentSubmitting ? "..." : "Add"}
        </button>
      </div>
    </div>
  ) : null;

  // For read-only: set innerHTML imperatively via ref so React re-renders
  // (from selection popup state changes) don't destroy in-progress text selection
  const readOnlyRef = useCallback((el: HTMLDivElement | null) => {
    localRef.current = el;
    if (el) {
      el.innerHTML = annotatedDisplayHtml || '<span style="color:var(--stage-faint);font-style:italic;">No content yet</span>';
    }
  }, [annotatedDisplayHtml]);

  if (!canEdit) {
    return (
      <div style={{ position: "relative", overflow: "visible" }}>
        {remoteCursors.length > 0 && (
          <div style={{ position: "absolute", top: -2, right: 8, zIndex: 5 }}>
            <RemoteCursorIndicator cursors={remoteCursors} />
          </div>
        )}
        {selectionPopupEl}
        {commentInputEl}
        <div
          ref={readOnlyRef}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const cueId = target.getAttribute("data-cue-id");
            if (cueId) {
              const cue = sceneCues.find((c) => c.id === cueId);
              if (cue) openCueEditor(cue);
            }
          }}
          style={{
            fontFamily: "Libre Baskerville, serif",
            fontSize: scriptTextSize,
            color: "var(--stage-text)",
            lineHeight: 1.75,
            padding: isMobile ? "8px" : "8px 16px",
            minHeight: 60,
            userSelect: "text",
            cursor: "text",
            overflow: "visible",
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
      {commentInputEl}
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
            // Don't re-focus if the target is an input/textarea (e.g. comment box)
            if (related.tagName !== "TEXTAREA" && related.tagName !== "INPUT") {
              setTimeout(() => localRef.current?.focus(), 0);
            }
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
