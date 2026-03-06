// ============================================
// SCRIPTUS — Script Text Parser
// ============================================
// Parses raw script text into structured scenes and lines.
// Detects: ACT/SCENE headers, character dialogue, stage directions, songs, transitions.

import type { LineType } from "@/types";

export interface ParsedLine {
  type: LineType;
  character?: string;
  text: string;
}

export interface ParsedScene {
  act: number;
  scene: number;
  title: string;
  lines: ParsedLine[];
}

// Roman numeral conversion
const ROMAN_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20,
};

function parseNumber(s: string): number {
  const upper = s.trim().toUpperCase();
  if (ROMAN_MAP[upper]) return ROMAN_MAP[upper];
  const n = parseInt(upper, 10);
  return isNaN(n) ? 1 : n;
}

// Patterns
const ACT_RE = /^(?:ACT)\s+([IVXLCDM]+|\d+)\s*[:\-–—.]?\s*(.*)?$/i;
const SCENE_RE = /^(?:SCENE)\s+([IVXLCDM]+|\d+)\s*[:\-–—.]?\s*(.*)?$/i;
const ACT_SCENE_RE = /^ACT\s+([IVXLCDM]+|\d+)\s*[,:\-–—]\s*SCENE\s+([IVXLCDM]+|\d+)\s*[:\-–—.]?\s*(.*)?$/i;
const TRANSITION_RE = /^(BLACKOUT|LIGHTS?\s*UP|LIGHTS?\s*DOWN|CURTAIN|END\s+OF\s+ACT|FADE\s*(IN|OUT|TO\s+BLACK)|CROSSFADE|SCENE\s+CHANGE)\s*\.?\s*$/i;
const SONG_RE = /^\(?\s*(SONG|MUSIC|MUSICAL\s+NUMBER|REPRISE)\s*[:\-–—]?\s*/i;

// A character name line: ALL CAPS word(s), optionally followed by . or : then dialogue
// Must be at least 2 chars, not a common stage direction word
const CHARACTER_RE = /^([A-Z][A-Z\s.''\-]{1,30}?)\s*[.:]?\s*$/;
const CHARACTER_WITH_DIALOGUE_RE = /^([A-Z][A-Z\s.''\-]{1,30}?)\s*[.:]\s+(.+)$/;
const CHARACTER_PAREN_RE = /^([A-Z][A-Z\s.''\-]{1,30}?)\s*\(([^)]*)\)\s*[.:]\s*(.*)$/;

// Stage direction: wrapped in ( ) or [ ]
const STAGE_DIR_WRAPPED_RE = /^\s*[\(\[].+[\)\]]\s*$/;

// Words that are NOT character names even if uppercase
const NOT_CHARACTERS = new Set([
  "THE", "AND", "BUT", "FOR", "NOR", "YET", "ACT", "SCENE", "END",
  "BLACKOUT", "CURTAIN", "INTERMISSION", "PROLOGUE", "EPILOGUE",
  "FADE", "LIGHTS", "CONTINUED", "CONT", "CONTINUED.",
  "SONG", "MUSIC", "REPRISE", "TRANSITION", "NOTE", "SETTING",
]);

function isCharacterName(s: string): boolean {
  const trimmed = s.trim().replace(/[.:]\s*$/, "");
  if (trimmed.length < 2 || trimmed.length > 35) return false;
  if (NOT_CHARACTERS.has(trimmed.toUpperCase())) return false;
  // Must be mostly uppercase letters
  const upper = trimmed.replace(/[\s.''\-]/g, "");
  if (upper.length < 2) return false;
  return upper === upper.toUpperCase() && /^[A-Z]/.test(upper);
}

function isStageDirection(text: string): boolean {
  const trimmed = text.trim();
  if (STAGE_DIR_WRAPPED_RE.test(trimmed)) return true;
  // Lines that start with common stage direction verbs in lower/mixed case
  const lower = trimmed.toLowerCase();
  const sdStarts = [
    "he ", "she ", "they ", "it ", "we ", "all ",
    "enter ", "exit ", "exeunt", "enters", "exits",
    "crosses ", "moves ", "turns ", "picks up", "puts down",
    "lights ", "music ", "sound ", "pause", "beat", "silence",
    "a ", "the ", "at ", "in ", "on ",
  ];
  for (const s of sdStarts) {
    if (lower.startsWith(s)) return true;
  }
  return false;
}

function cleanText(text: string): string {
  return text.replace(/\r/g, "").trim();
}

export function parseScriptText(rawText: string): ParsedScene[] {
  const lines = rawText.split("\n");
  const scenes: ParsedScene[] = [];

  let currentAct = 1;
  let currentSceneNum = 0;
  let currentTitle = "";
  let currentLines: ParsedLine[] = [];
  let lastCharacter: string | null = null;

  function flushScene() {
    if (currentLines.length > 0) {
      if (currentSceneNum === 0) currentSceneNum = 1;
      scenes.push({
        act: currentAct,
        scene: currentSceneNum,
        title: currentTitle || `Scene ${currentSceneNum}`,
        lines: currentLines,
      });
      currentLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = cleanText(lines[i]);
    if (!raw) {
      lastCharacter = null;
      continue;
    }

    // Check for combined ACT + SCENE header
    const actSceneMatch = raw.match(ACT_SCENE_RE);
    if (actSceneMatch) {
      flushScene();
      currentAct = parseNumber(actSceneMatch[1]);
      currentSceneNum = parseNumber(actSceneMatch[2]);
      currentTitle = actSceneMatch[3]?.trim() || `Act ${currentAct}, Scene ${currentSceneNum}`;
      lastCharacter = null;
      continue;
    }

    // Check for ACT header
    const actMatch = raw.match(ACT_RE);
    if (actMatch) {
      flushScene();
      currentAct = parseNumber(actMatch[1]);
      currentSceneNum = 0; // Reset scene counter for new act
      const actTitle = actMatch[2]?.trim();
      if (actTitle) {
        // ACT header with a title but no scene — start a new scene
        currentSceneNum = 1;
        currentTitle = actTitle;
      }
      currentLines.push({ type: "ACT_HEADER", text: raw });
      lastCharacter = null;
      continue;
    }

    // Check for SCENE header
    const sceneMatch = raw.match(SCENE_RE);
    if (sceneMatch) {
      flushScene();
      currentSceneNum = parseNumber(sceneMatch[1]);
      currentTitle = sceneMatch[2]?.trim() || `Scene ${currentSceneNum}`;
      currentLines.push({ type: "SCENE_HEADER", text: raw });
      lastCharacter = null;
      continue;
    }

    // Check for transition
    if (TRANSITION_RE.test(raw)) {
      currentLines.push({ type: "TRANSITION", text: raw });
      lastCharacter = null;
      continue;
    }

    // Check for song
    if (SONG_RE.test(raw)) {
      const songText = raw.replace(SONG_RE, "").trim() || raw;
      currentLines.push({ type: "SONG", character: lastCharacter || undefined, text: songText });
      continue;
    }

    // Check for character name with parenthetical and dialogue: "HAMLET (aside): To be..."
    const charParenMatch = raw.match(CHARACTER_PAREN_RE);
    if (charParenMatch && isCharacterName(charParenMatch[1])) {
      const charName = charParenMatch[1].trim();
      const paren = charParenMatch[2].trim();
      const dialogue = charParenMatch[3]?.trim();
      lastCharacter = charName;
      if (paren) {
        currentLines.push({ type: "STAGE_DIRECTION", text: `(${paren})` });
      }
      if (dialogue) {
        currentLines.push({ type: "DIALOGUE", character: charName, text: dialogue });
      }
      continue;
    }

    // Check for character name with dialogue on same line: "HAMLET: To be or not to be"
    const charDialogueMatch = raw.match(CHARACTER_WITH_DIALOGUE_RE);
    if (charDialogueMatch && isCharacterName(charDialogueMatch[1])) {
      const charName = charDialogueMatch[1].trim();
      lastCharacter = charName;
      currentLines.push({
        type: "DIALOGUE",
        character: charName,
        text: charDialogueMatch[2].trim(),
      });
      continue;
    }

    // Check for standalone character name (dialogue follows on next lines)
    if (CHARACTER_RE.test(raw) && isCharacterName(raw.replace(/[.:]\s*$/, ""))) {
      lastCharacter = raw.replace(/[.:]\s*$/, "").trim();
      continue;
    }

    // Check for stage direction (parenthesized or bracketed)
    if (STAGE_DIR_WRAPPED_RE.test(raw)) {
      currentLines.push({ type: "STAGE_DIRECTION", text: raw.replace(/^[\(\[]\s*/, "").replace(/\s*[\)\]]$/, "") });
      continue;
    }

    // If we have a current character, this is their dialogue continuation
    if (lastCharacter) {
      // Check if this line is an inline stage direction within dialogue
      if (isStageDirection(raw) && !raw.match(/[a-z]{3,}/)) {
        currentLines.push({ type: "STAGE_DIRECTION", text: raw });
        continue;
      }
      currentLines.push({ type: "DIALOGUE", character: lastCharacter, text: raw });
      continue;
    }

    // Default: if mostly lowercase or starts with stage-direction-like text, it's a direction
    if (isStageDirection(raw)) {
      currentLines.push({ type: "STAGE_DIRECTION", text: raw });
    } else {
      // Fallback: treat as stage direction if no character context
      currentLines.push({ type: "STAGE_DIRECTION", text: raw });
    }
  }

  // Flush any remaining lines
  flushScene();

  // If no scenes were detected, create a single scene with all content
  if (scenes.length === 0 && currentLines.length > 0) {
    scenes.push({
      act: 1,
      scene: 1,
      title: "Scene 1",
      lines: currentLines,
    });
  }

  return scenes;
}
