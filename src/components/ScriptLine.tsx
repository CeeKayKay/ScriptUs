"use client";

import { forwardRef, useRef, useCallback, useState, useEffect } from "react";
import { CueBadge } from "./CueBadge";
import { CUE_TYPES } from "@/lib/cue-types";
import type { ScriptLineView, CueType, CueView, LineType, ProjectRole } from "@/types";

interface ScriptLineProps {
  line: ScriptLineView;
  visibleCueTypes: CueType[];
  activeCueId: string | null;
  activeRole: ProjectRole;
  onCueClick: (cue: CueView) => void;
  onAddCue?: (lineId: string, selectedText?: string) => void;
  showAddButton?: boolean;
  canEdit?: boolean;
  scriptTextSize?: number;
  onEditLine?: (lineId: string, updates: { text?: string; character?: string; type?: LineType }) => void;
  onDeleteLine?: (lineId: string) => void;
  onEditSceneTitle?: (sceneId: string, title: string) => void;
  onDeleteScene?: (sceneId: string) => void;
}

// ---- Text with inline cue highlights and badges above highlighted text ----

interface CueSegment {
  text: string;
  cue: CueView | null;
  color: string | null;
}

function buildCueSegments(text: string, cues: CueView[]): CueSegment[] {
  // Build a list of highlight regions from cues with scriptRef
  const regions: { start: number; end: number; cue: CueView; color: string }[] = [];

  for (const cue of cues) {
    if (!cue.scriptRef) continue;
    const idx = text.indexOf(cue.scriptRef);
    if (idx === -1) continue;
    const config = CUE_TYPES[cue.type];
    if (!config) continue;
    regions.push({ start: idx, end: idx + cue.scriptRef.length, cue, color: config.color });
  }

  // Sort by start position
  regions.sort((a, b) => a.start - b.start);

  if (regions.length === 0) {
    return [{ text, cue: null, color: null }];
  }

  const segments: CueSegment[] = [];
  let pos = 0;

  for (const region of regions) {
    // Skip overlapping regions
    if (region.start < pos) continue;

    // Text before this region
    if (region.start > pos) {
      segments.push({ text: text.slice(pos, region.start), cue: null, color: null });
    }

    // The highlighted region
    segments.push({
      text: text.slice(region.start, region.end),
      cue: region.cue,
      color: region.color,
    });

    pos = region.end;
  }

  // Remaining text after last region
  if (pos < text.length) {
    segments.push({ text: text.slice(pos), cue: null, color: null });
  }

  return segments;
}

function CuedText({
  text,
  cues,
  activeCueId,
  onCueClick,
  style,
  tag: Tag = "span",
  activeRole,
  lineId,
  onAddCue,
  showAddButton,
}: {
  text: string;
  cues: CueView[];
  activeCueId: string | null;
  onCueClick: (cue: CueView) => void;
  style?: React.CSSProperties;
  tag?: "span" | "div";
  activeRole?: ProjectRole;
  lineId?: string;
  onAddCue?: (lineId: string, selectedText?: string) => void;
  showAddButton?: boolean;
}) {
  const elRef = useRef<HTMLElement>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);

  const cueLabel = activeRole ? getSelectionCueLabel(activeRole) : null;
  const canShowCue = !!(cueLabel && lineId && onAddCue && showAddButton);

  useEffect(() => {
    if (!canShowCue) return;
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !elRef.current) {
        setHasSelection(false);
        return;
      }
      if (!elRef.current.contains(sel.anchorNode)) {
        setHasSelection(false);
        return;
      }
      const hasText = !sel.isCollapsed && sel.toString().trim().length > 0;
      setHasSelection(hasText);
      if (hasText) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const parentRect = elRef.current.parentElement?.getBoundingClientRect();
        if (parentRect) {
          setPopupPos({
            x: rect.left - parentRect.left + rect.width / 2,
            y: rect.top - parentRect.top - 34,
          });
        }
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [canShowCue]);

  const segments = buildCueSegments(text, cues);
  // Cues without scriptRef that still need badges shown (below text)
  const cuesWithoutRef = cues.filter((c) => !c.scriptRef || !text.includes(c.scriptRef));

  return (
    <span style={{ position: "relative", display: Tag === "div" ? "block" : "inline" }}>
      <CuePopup show={hasSelection} pos={popupPos} cueLabel={cueLabel} lineId={lineId} onAddCue={onAddCue} />
      <Tag ref={elRef as any} style={style}>
        {segments.map((seg, i) => {
          if (!seg.cue || !seg.color) {
            return <span key={i}>{seg.text}</span>;
          }

          const isActive = seg.cue.id === activeCueId;

          return (
            <span
              key={i}
              style={{ position: "relative", display: "inline" }}
            >
              {/* Cue badge above the first word */}
              <span
                style={{
                  position: "absolute",
                  top: "-1.6em",
                  left: 0,
                  zIndex: 10,
                  pointerEvents: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                <CueBadge
                  cue={seg.cue}
                  isActive={isActive}
                  onClick={() => onCueClick(seg.cue!)}
                  compact
                />
              </span>
              {/* Highlighted text */}
              <span
                style={{
                  background: `${seg.color}20`,
                  borderBottom: `2px solid ${seg.color}`,
                  borderRadius: 2,
                  padding: "1px 0",
                  color: seg.color,
                  transition: "all 0.2s ease",
                }}
              >
                {seg.text}
              </span>
            </span>
          );
        })}
      </Tag>
      {/* Badges for cues without scriptRef */}
      {cuesWithoutRef.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1.5 ml-2">
          {cuesWithoutRef.map((cue) => (
            <CueBadge
              key={cue.id}
              cue={cue}
              isActive={cue.id === activeCueId}
              onClick={() => onCueClick(cue)}
              compact
            />
          ))}
        </span>
      )}
    </span>
  );
}

export const ScriptLine = forwardRef<HTMLDivElement, ScriptLineProps>(
  function ScriptLine(
    {
      line,
      visibleCueTypes,
      activeCueId,
      activeRole,
      onCueClick,
      onAddCue,
      showAddButton,
      canEdit,
      scriptTextSize = 20,
      onEditLine,
      onDeleteLine,
      onEditSceneTitle,
      onDeleteScene,
    },
    ref
  ) {
    const relevantCues = line.cues.filter((c) =>
      visibleCueTypes.includes(c.type)
    );
    const hasActiveCue = relevantCues.some((c) => c.id === activeCueId);
    const activeCue = relevantCues.find((c) => c.id === activeCueId);
    const activeCueConfig = activeCue ? CUE_TYPES[activeCue.type] : null;

    // --- Act Header ---
    if (line.type === "ACT_HEADER") {
      return (
        <div
          ref={ref}
          data-line-id={line.id}
          className="pt-8 pb-4 text-center"
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "#E8C547",
            borderBottom: "1px solid rgba(232, 197, 71, 0.18)",
            marginBottom: 16,
          }}
        >
          {line.text}
        </div>
      );
    }

    // --- Scene Header (inline editable title) ---
    if (line.type === "SCENE_HEADER") {
      const sceneId = (line as any)._sceneId || line.sceneId;
      const match = line.text.match(/^(Scene \d+ — )(.+)$/);
      const prefix = match ? match[1] : "";
      const titleText = match ? match[2] : line.text;

      return (
        <div
          ref={ref}
          data-line-id={line.id}
          className="pt-6 pb-3 group/scene"
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: Math.round(scriptTextSize * 0.9),
            fontWeight: 600,
            color: "#c8c0b0",
            letterSpacing: "0.08em",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 12,
            position: "relative",
          }}
        >
          <span>{prefix}</span>
          {canEdit ? (
            <EditableText
              text={titleText}
              tag="span"
              style={{
                outline: "none",
                borderBottom: "1px dashed transparent",
                transition: "border-color 0.2s",
              }}
              focusStyle={{ borderBottom: "1px dashed #E8C54740" }}
              onSave={(newTitle) => {
                if (newTitle.trim() && newTitle !== titleText) {
                  onEditSceneTitle?.(sceneId, newTitle.trim());
                }
              }}
            />
          ) : (
            <span>{titleText}</span>
          )}
          {canEdit && (
            <button
              onClick={() => {
                if (confirm("Delete this scene and all its lines?")) {
                  onDeleteScene?.(sceneId);
                }
              }}
              className="ml-3 opacity-0 group-hover/scene:opacity-100 transition-opacity align-middle px-1.5 py-0.5 rounded text-[10px] hover:bg-red-500/10"
              style={{
                fontFamily: "DM Mono, monospace",
                color: "#E84747",
                border: "1px solid #E8474740",
              }}
            >
              Delete
            </button>
          )}
        </div>
      );
    }

    // --- Stage Direction / Transition ---
    if (line.type === "STAGE_DIRECTION" || line.type === "TRANSITION") {
      return (
        <div
          ref={ref}
          data-line-id={line.id}
          className="script-line group"
          style={{
            padding: "8px 16px",
            paddingTop: relevantCues.some((c) => c.scriptRef) ? 28 : 8,
            margin: "5px 0",
            background: hasActiveCue ? "rgba(255,255,255,0.03)" : undefined,
            borderLeft: hasActiveCue
              ? `2px solid ${activeCueConfig?.color || "#555"}`
              : "2px solid transparent",
            borderRadius: 4,
            transition: "all 0.3s ease",
          }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              {canEdit ? (
                <EditableCuedText
                  text={line.text}
                  cues={relevantCues}
                  activeCueId={activeCueId}
                  onCueClick={onCueClick}
                  tag="span"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: Math.round(scriptTextSize * 0.7),
                    color: "#8a8070",
                    fontStyle: "italic",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    outline: "none",
                  }}
                  focusStyle={{ background: "rgba(255,255,255,0.03)" }}
                  multiline
                  activeRole={activeRole}
                  lineId={line.id}
                  onAddCue={onAddCue}
                  showAddButton={showAddButton}
                  onSave={(newText) => {
                    if (newText.trim() && newText !== line.text) {
                      onEditLine?.(line.id, { text: newText.trim() });
                    }
                  }}
                />
              ) : (
                <CuedText
                  text={line.text}
                  cues={relevantCues}
                  activeCueId={activeCueId}
                  onCueClick={onCueClick}
                  tag="span"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: Math.round(scriptTextSize * 0.7),
                    color: "#8a8070",
                    fontStyle: "italic",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                  activeRole={showAddButton ? activeRole : undefined}
                  lineId={line.id}
                  onAddCue={onAddCue}
                  showAddButton={showAddButton}
                />
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  if (confirm("Delete this line?")) onDeleteLine?.(line.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-red-500/10"
                style={{
                  fontFamily: "DM Mono, monospace",
                  color: "#E84747",
                  border: "1px solid #E8474740",
                }}
              >
                Del
              </button>
            )}
          </div>
        </div>
      );
    }

    // --- Dialogue / Song ---
    if (line.type === "DIALOGUE" || line.type === "SONG") {
      return (
        <div
          ref={ref}
          data-line-id={line.id}
          className="script-line group flex gap-4"
          style={{
            padding: "3px 0 3px 16px",
            paddingTop: relevantCues.some((c) => c.scriptRef) ? 24 : 3,
            margin: "2px 0",
            background: hasActiveCue ? "rgba(255,255,255,0.03)" : undefined,
            borderLeft: hasActiveCue
              ? `2px solid ${activeCueConfig?.color || "#555"}`
              : "2px solid transparent",
            borderRadius: 4,
            transition: "all 0.3s ease",
          }}
        >
          {/* Character name */}
          <div
            className="flex-shrink-0 text-right"
            style={{ width: 110, paddingTop: 3 }}
          >
            {canEdit ? (
              <EditableText
                text={line.character || ""}
                tag="div"
                placeholder="NAME"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#E8C547",
                  letterSpacing: "0.05em",
                  textAlign: "right",
                  outline: "none",
                }}
                focusStyle={{ background: "rgba(232,197,71,0.06)", borderRadius: 3 }}
                onSave={(newChar) => {
                  const upper = newChar.trim().toUpperCase();
                  if (upper !== (line.character || "")) {
                    onEditLine?.(line.id, { character: upper });
                  }
                }}
              />
            ) : (
              <div
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#E8C547",
                  letterSpacing: "0.05em",
                }}
              >
                {line.character}
              </div>
            )}
          </div>

          {/* Dialogue text + cues */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                {canEdit ? (
                  <EditableCuedText
                    text={line.text}
                    cues={relevantCues}
                    activeCueId={activeCueId}
                    onCueClick={onCueClick}
                    tag="div"
                    style={{
                      fontFamily: "Libre Baskerville, serif",
                      fontSize: scriptTextSize,
                      color: "#ffffff",
                      lineHeight: 1.75,
                      whiteSpace: "pre-wrap",
                      outline: "none",
                    }}
                    focusStyle={{ background: "rgba(255,255,255,0.03)", borderRadius: 4 }}
                    multiline
                    activeRole={activeRole}
                    lineId={line.id}
                    onAddCue={onAddCue}
                    showAddButton={showAddButton}
                    onSave={(newText) => {
                      if (newText.trim() && newText !== line.text) {
                        onEditLine?.(line.id, { text: newText.trim() });
                      }
                    }}
                  />
                ) : (
                  <CuedText
                    text={line.text}
                    cues={relevantCues}
                    activeCueId={activeCueId}
                    onCueClick={onCueClick}
                    tag="div"
                    style={{
                      fontFamily: "Libre Baskerville, serif",
                      fontSize: scriptTextSize,
                      color: "#ffffff",
                      lineHeight: 1.75,
                      whiteSpace: "pre-wrap",
                    }}
                    activeRole={showAddButton ? activeRole : undefined}
                    lineId={line.id}
                    onAddCue={onAddCue}
                    showAddButton={showAddButton}
                  />
                )}
              </div>
              {canEdit && (
                <button
                  onClick={() => {
                    if (confirm("Delete this line?")) onDeleteLine?.(line.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-red-500/10"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    color: "#E84747",
                    border: "1px solid #E8474740",
                  }}
                >
                  Del
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  }
);

// ---- Editable + Cued text: shows CuedText by default, switches to EditableText on double-click ----

function EditableCuedText({
  text,
  cues,
  activeCueId,
  onCueClick,
  tag,
  style,
  focusStyle,
  multiline,
  activeRole,
  lineId,
  onAddCue,
  showAddButton,
  onSave,
}: {
  text: string;
  cues: CueView[];
  activeCueId: string | null;
  onCueClick: (cue: CueView) => void;
  tag?: "span" | "div";
  style?: React.CSSProperties;
  focusStyle?: React.CSSProperties;
  multiline?: boolean;
  activeRole?: ProjectRole;
  lineId?: string;
  onAddCue?: (lineId: string, selectedText?: string) => void;
  showAddButton?: boolean;
  onSave: (newText: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <EditableText
        text={text}
        tag={tag}
        style={style}
        focusStyle={focusStyle}
        multiline={multiline}
        activeRole={activeRole}
        lineId={lineId}
        onAddCue={onAddCue}
        autoFocus
        onSave={(newText) => {
          onSave(newText);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <span onDoubleClick={() => setIsEditing(true)} style={{ cursor: "text" }}>
      <CuedText
        text={text}
        cues={cues}
        activeCueId={activeCueId}
        onCueClick={onCueClick}
        tag={tag}
        style={style}
        activeRole={showAddButton ? activeRole : undefined}
        lineId={lineId}
        onAddCue={onAddCue}
        showAddButton={showAddButton}
      />
    </span>
  );
}

// ---- Inline editable text component ----

function getSelectionCueLabel(role: ProjectRole): { label: string; color: string } | null {
  switch (role) {
    case "LIGHTING":
      return { label: "+ cue", color: "#E8C547" };
    case "SOUND":
      return { label: "+ cue", color: "#E87847" };
    case "ACTOR":
      return { label: "+ cue", color: "#F5F5F5" };
    case "PROPS":
      return { label: "+ prop", color: "#C847E8" };
    case "SET_DESIGN":
      return { label: "+ set", color: "#7BE847" };
    case "STAGE_MANAGER":
      return { label: "+ cue", color: "#47B8E8" };
    case "DIRECTOR":
      return { label: "+ cue", color: "#F5F5F5" };
    default:
      return null;
  }
}

function EditableText({
  text,
  tag: Tag = "span",
  style,
  focusStyle,
  placeholder,
  multiline,
  onSave,
  onCancel,
  autoFocus,
  activeRole,
  lineId,
  onAddCue,
}: {
  text: string;
  tag?: "span" | "div";
  style?: React.CSSProperties;
  focusStyle?: React.CSSProperties;
  placeholder?: string;
  multiline?: boolean;
  onSave: (newText: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  activeRole?: ProjectRole;
  lineId?: string;
  onAddCue?: (lineId: string, selectedText?: string) => void;
}) {
  const elRef = useRef<HTMLElement>(null);
  const originalRef = useRef(text);
  const focusedRef = useRef(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);

  const updateToolbarPosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !elRef.current) return;
    if (!elRef.current.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const hasTextSelected = !sel.isCollapsed && sel.toString().trim().length > 0;
    setHasSelection(hasTextSelected);

    const wrapperEl = elRef.current.parentElement;
    const parentRect = wrapperEl?.getBoundingClientRect();
    if (parentRect) {
      if (hasTextSelected) {
        setToolbarPos({ x: rect.left - parentRect.left + rect.width / 2, y: rect.top - parentRect.top - 34 });
      } else {
        setToolbarPos({ x: rect.left - parentRect.left, y: rect.top - parentRect.top - 34 });
      }
    }
  }, []);

  useEffect(() => {
    if (!multiline) return;
    const handler = () => {
      if (focusedRef.current) {
        updateToolbarPosition();
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [multiline, updateToolbarPosition]);

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
    originalRef.current = elRef.current?.innerText || text;
    if (focusStyle && elRef.current) {
      Object.assign(elRef.current.style, focusStyle);
    }
    if (multiline) {
      setShowToolbar(true);
      setTimeout(updateToolbarPosition, 0);
    }
  }, [text, focusStyle, multiline, updateToolbarPosition]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.closest("[data-format-toolbar]")) {
      setTimeout(() => elRef.current?.focus(), 0);
      return;
    }
    focusedRef.current = false;
    setShowToolbar(false);
    const newText = elRef.current?.innerText || "";
    if (focusStyle && elRef.current) {
      for (const key of Object.keys(focusStyle)) {
        (elRef.current.style as any)[key] = (style as any)?.[key] || "";
      }
    }
    if (newText !== originalRef.current) {
      onSave(newText);
    } else {
      onCancel?.();
    }
  }, [onSave, onCancel, focusStyle, style]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (elRef.current) {
          elRef.current.innerText = originalRef.current;
        }
        elRef.current?.blur();
        onCancel?.();
      }
      if (!multiline && e.key === "Enter") {
        e.preventDefault();
        elRef.current?.blur();
      }
      if (multiline && e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          document.execCommand("insertText", false, "");
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            let node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent || "";
              const offset = range.startOffset;
              const beforeCursor = text.slice(0, offset);
              const lineStart = beforeCursor.lastIndexOf("\n") + 1;
              const lineContent = text.slice(lineStart);
              const match = lineContent.match(/^( {1,4})/);
              if (match) {
                const removed = match[1].length;
                node.textContent = text.slice(0, lineStart) + text.slice(lineStart + removed);
                const newRange = document.createRange();
                newRange.setStart(node, Math.max(lineStart, offset - removed));
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
            }
          }
        } else {
          document.execCommand("insertText", false, "    ");
        }
      }
      if (multiline) {
        setTimeout(updateToolbarPosition, 0);
      }
    },
    [multiline, updateToolbarPosition]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, plainText);
  }, []);

  // Auto-focus when switching from CuedText to EditableText
  useEffect(() => {
    if (autoFocus && elRef.current) {
      elRef.current.focus();
    }
  }, [autoFocus]);

  const cueLabel = activeRole ? getSelectionCueLabel(activeRole) : null;
  const showCueButton = hasSelection && cueLabel && lineId && onAddCue;

  return (
    <span style={{ position: "relative", display: Tag === "div" ? "block" : "inline" }}>
      <CuePopup show={!!(showToolbar && showCueButton)} pos={toolbarPos} cueLabel={cueLabel} lineId={lineId} onAddCue={onAddCue} />
      <Tag
        ref={elRef as any}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        style={{
          cursor: "text",
          minWidth: 20,
          ...style,
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder}
      >
        {text}
      </Tag>
    </span>
  );
}

// ---- Cue popup button (shared between EditableText and CuedText) ----

function CuePopup({ show, pos, cueLabel, lineId, onAddCue }: {
  show: boolean;
  pos: { x: number; y: number } | null;
  cueLabel: { label: string; color: string } | null;
  lineId?: string;
  onAddCue?: (lineId: string, selectedText?: string) => void;
}) {
  if (!show || !pos || !cueLabel || !lineId || !onAddCue) return null;
  return (
    <div
      data-format-toolbar
      style={{
        position: "absolute",
        top: pos.y,
        left: Math.max(0, pos.x - 40),
        zIndex: 20,
        background: "#1a1916",
        border: `1px solid ${cueLabel.color}40`,
        borderRadius: 5,
        padding: "3px 4px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        transition: "top 0.1s ease, left 0.1s ease",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        style={{
          fontFamily: "DM Mono, monospace",
          fontSize: 12,
          fontWeight: 600,
          color: cueLabel.color,
          background: `${cueLabel.color}15`,
          border: `1px solid ${cueLabel.color}40`,
          borderRadius: 3,
          padding: "3px 10px",
          cursor: "pointer",
          lineHeight: 1.4,
        }}
        onClick={() => {
          const selectedText = window.getSelection()?.toString().trim();
          onAddCue(lineId, selectedText);
        }}
      >
        {cueLabel.label}
      </button>
    </div>
  );
}
