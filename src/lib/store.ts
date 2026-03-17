import { create } from "zustand";
import type { ProjectRole, CueType, CueView, SceneView, ScriptLineView, MemberView, CustomRoleView, CustomCueTypeView, CueStatus, CommentView, CharacterGroupView, CharacterView, LocationView } from "@/types";

type CuePanelSide = "left" | "right";

// Cue numbering format settings per cue type
export type CueNumberFormat = "numbers" | "letters";
export interface CueNumberingSetting {
  format: CueNumberFormat;
  nextValue: number; // Always stored as a number, converted to letter for display
}
export type CueNumberingSettings = Record<string, CueNumberingSetting>;

export interface StageStore {
  // Current user context (can be built-in ProjectRole or custom role ID)
  activeRole: string;
  setActiveRole: (role: string) => void;

  // Project data
  projectId: string | null;
  projectTitle: string;
  scenes: SceneView[];
  members: MemberView[];
  customRoles: CustomRoleView[];
  customCueTypes: CustomCueTypeView[];
  // Per-project color overrides for built-in cue types (per theme)
  cueTypeColorOverrides: Record<string, string>;      // dark theme
  cueTypeColorOverridesLight: Record<string, string>;  // light theme
  setCueTypeColorOverrides: (overrides: Record<string, string>) => void;
  setCueTypeColorOverridesLight: (overrides: Record<string, string>) => void;
  setCueTypeColorOverride: (cueType: string, color: string, theme: "dark" | "light") => void;

  // Cue numbering settings per cue type
  cueNumberingSettings: CueNumberingSettings;
  setCueNumberingSettings: (settings: CueNumberingSettings) => void;
  updateCueNumberingSetting: (cueType: string, setting: Partial<CueNumberingSetting>) => void;
  getNextCueValue: (cueType: string) => { value: number; display: string };
  incrementCueCounter: (cueType: string) => void;
  setProject: (data: {
    id: string;
    title: string;
    scenes: SceneView[];
    members: MemberView[];
    customRoles?: CustomRoleView[];
    customCueTypes?: CustomCueTypeView[];
    cueTypeColors?: Record<string, string> | null;
    cueTypeColorsLight?: Record<string, string> | null;
    cueNumberingSettings?: CueNumberingSettings | null;
  }) => void;

  // UI state
  activeCueId: string | null;
  setActiveCueId: (id: string | null) => void;

  activeSceneId: string | null;
  setActiveSceneId: (id: string | null) => void;

  visibleLineIds: Set<string>;
  setVisibleLineIds: (ids: Set<string>) => void;

  isCuePanelOpen: boolean;
  toggleCuePanel: () => void;

  isCueEditorOpen: boolean;
  editingCue: CueView | null;
  newCueLineId: string | null;
  newCueSceneId: string | null;
  newCueSelectedText: string | null;
  openCueEditor: (cue?: CueView, lineId?: string, sceneId?: string, selectedText?: string) => void;
  closeCueEditor: () => void;
  addCueToLine: (sceneId: string, lineId: string, cue: CueView) => void;
  removeCueFromLine: (sceneId: string, lineId: string, cueId: string) => void;
  updateCueInStore: (cueId: string, updates: Partial<CueView>) => void;
  reorderCuesInStore: (cueType: CueType, orderedCueIds: string[]) => void;

  // Settings
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;

  // Cue panel side preference (persisted to localStorage)
  cuePanelSide: CuePanelSide;
  setCuePanelSide: (side: CuePanelSide) => void;

  // Script text size (persisted to localStorage)
  scriptTextSize: number;
  setScriptTextSize: (size: number) => void;

  // Scene/line mutations
  addScene: (scene: SceneView, position?: string) => void;
  addLineToScene: (sceneId: string, line: ScriptLineView) => void;
  updateSceneTitle: (sceneId: string, title: string) => void;
  updateLine: (sceneId: string, lineId: string, updates: Partial<ScriptLineView>) => void;
  deleteLine: (sceneId: string, lineId: string) => void;
  deleteScene: (sceneId: string) => void;

  // Comments
  isCommentPanelOpen: boolean;
  toggleCommentPanel: () => void;
  addComment: (lineId: string, comment: CommentView) => void;
  resolveComment: (commentId: string) => void;
  removeComment: (commentId: string) => void;
  selectedCommentRef: string | null;
  setSelectedCommentRef: (ref: string | null) => void;

  // Writer: Characters & Locations
  characterGroups: CharacterGroupView[];
  ungroupedCharacters: CharacterView[];
  locations: LocationView[];
  setCharacterGroups: (groups: CharacterGroupView[]) => void;
  setUngroupedCharacters: (chars: CharacterView[]) => void;
  setLocations: (locs: LocationView[]) => void;

  // Search/filter
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Presence
  onlineUsers: Array<{
    userId: string;
    name: string;
    color: string;
    role: ProjectRole;
  }>;
  setOnlineUsers: (
    users: Array<{
      userId: string;
      name: string;
      color: string;
      role: ProjectRole;
    }>
  ) => void;

  // Pending dialogue insertion (from Writer panel character click)
  pendingDialogue: { character: string } | null;
  setPendingDialogue: (pd: { character: string } | null) => void;

  // Remote cursors
  remoteCursors: Array<{
    userId: string;
    name: string;
    color: string;
    lineId: string;
    field: "text" | "character" | "title" | null;
  }>;
  setRemoteCursors: (
    cursors: Array<{
      userId: string;
      name: string;
      color: string;
      lineId: string;
      field: "text" | "character" | "title" | null;
    }>
  ) => void;

  // Stage Manager cue type visibility toggles
  hiddenCueTypes: Set<string>;
  toggleCueTypeVisibility: (cueType: string) => void;
  isCueTypeVisible: (cueType: string) => boolean;

  // Role ordering for "View as" bar
  roleOrder: string[];
  setRoleOrder: (order: string[]) => void;

  // Per-role cue bubble visibility (which roles show cue bubbles)
  roleCueBubbles: Set<string>;
  toggleRoleCueBubbles: (roleId: string) => void;
  hasRoleCueBubbles: (roleId: string) => boolean;
}

// Read persisted cue panel side from localStorage
function getPersistedScriptTextSize(): number {
  if (typeof window === "undefined") return 20;
  try {
    const saved = localStorage.getItem("scriptus-text-size");
    if (saved) {
      const n = Number(saved);
      if (n >= 12 && n <= 36) return n;
    }
  } catch {}
  return 20;
}

function getPersistedCuePanelSide(): CuePanelSide {
  if (typeof window === "undefined") return "right";
  try {
    const saved = localStorage.getItem("scriptus-cue-panel-side");
    if (saved === "left" || saved === "right") return saved;
  } catch {}
  return "right";
}

function getPersistedActiveRole(): string {
  if (typeof window === "undefined") return "STAGE_MANAGER";
  try {
    const saved = localStorage.getItem("scriptus-active-role");
    if (saved) return saved;
  } catch {}
  return "STAGE_MANAGER";
}

function getPersistedHiddenCueTypes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = localStorage.getItem("scriptus-hidden-cue-types");
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set();
}

function getPersistedRoleOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("scriptus-role-order");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function getPersistedRoleCueBubbles(): Set<string> {
  if (typeof window === "undefined") return new Set(["STAGE_MANAGER", "LIGHTING", "SOUND"]);
  try {
    const saved = localStorage.getItem("scriptus-role-cue-bubbles");
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  // Default: Stage Manager, Lighting, and Sound show cue bubbles
  return new Set(["STAGE_MANAGER", "LIGHTING", "SOUND"]);
}

// Helper function to convert a number to letter sequence (1=A, 2=B, ..., 26=Z, 27=AA)
export function numberToLetters(n: number): string {
  let result = "";
  while (n > 0) {
    n--; // Adjust for 0-based
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result || "A";
}

// Helper function to convert letter sequence to number (A=1, B=2, ..., Z=26, AA=27)
export function lettersToNumber(letters: string): number {
  let result = 0;
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64);
  }
  return result || 1;
}

export const useStageStore = create<StageStore>((set, get) => ({
  // Defaults
  activeRole: getPersistedActiveRole(),
  setActiveRole: (role) => {
    try {
      localStorage.setItem("scriptus-active-role", role);
    } catch {}
    set({ activeRole: role, activeCueId: null });
  },

  projectId: null,
  projectTitle: "",
  scenes: [],
  members: [],
  customRoles: [],
  customCueTypes: [],
  cueTypeColorOverrides: {},
  cueTypeColorOverridesLight: {},
  setCueTypeColorOverrides: (overrides) => set({ cueTypeColorOverrides: overrides }),
  setCueTypeColorOverridesLight: (overrides) => set({ cueTypeColorOverridesLight: overrides }),
  setCueTypeColorOverride: (cueType, color, theme) =>
    set((s) => theme === "light"
      ? { cueTypeColorOverridesLight: { ...s.cueTypeColorOverridesLight, [cueType]: color } }
      : { cueTypeColorOverrides: { ...s.cueTypeColorOverrides, [cueType]: color } }
    ),

  // Cue numbering settings
  cueNumberingSettings: {},
  setCueNumberingSettings: (settings) => set({ cueNumberingSettings: settings }),
  updateCueNumberingSetting: (cueType, setting) =>
    set((s) => ({
      cueNumberingSettings: {
        ...s.cueNumberingSettings,
        [cueType]: {
          format: s.cueNumberingSettings[cueType]?.format || "numbers",
          nextValue: s.cueNumberingSettings[cueType]?.nextValue || 1,
          ...setting,
        },
      },
    })),
  getNextCueValue: (cueType) => {
    const state = get();
    const setting = state.cueNumberingSettings[cueType] || { format: "numbers", nextValue: 1 };
    const value = setting.nextValue;
    let display: string;
    if (setting.format === "letters") {
      display = numberToLetters(value);
    } else {
      display = String(value);
    }
    return { value, display };
  },
  incrementCueCounter: (cueType) =>
    set((s) => {
      const current = s.cueNumberingSettings[cueType] || { format: "numbers", nextValue: 1 };
      return {
        cueNumberingSettings: {
          ...s.cueNumberingSettings,
          [cueType]: {
            ...current,
            nextValue: current.nextValue + 1,
          },
        },
      };
    }),

  setProject: ({ id, title, scenes, members, customRoles, customCueTypes, cueTypeColors, cueTypeColorsLight, cueNumberingSettings }) =>
    set({
      projectId: id,
      projectTitle: title,
      scenes,
      members,
      customRoles: customRoles || [],
      customCueTypes: customCueTypes || [],
      cueTypeColorOverrides: (cueTypeColors as Record<string, string>) || {},
      cueTypeColorOverridesLight: (cueTypeColorsLight as Record<string, string>) || {},
      cueNumberingSettings: (cueNumberingSettings as CueNumberingSettings) || {},
    }),

  activeCueId: null,
  setActiveCueId: (id) => set({ activeCueId: id }),

  activeSceneId: null,
  setActiveSceneId: (id) => set({ activeSceneId: id }),

  visibleLineIds: new Set(),
  setVisibleLineIds: (ids) => set({ visibleLineIds: ids }),

  isCuePanelOpen: true,
  toggleCuePanel: () => set((s) => ({ isCuePanelOpen: !s.isCuePanelOpen })),

  isCueEditorOpen: false,
  editingCue: null,
  newCueLineId: null,
  newCueSceneId: null,
  newCueSelectedText: null,
  openCueEditor: (cue, lineId, sceneId, selectedText) =>
    set({
      isCueEditorOpen: true,
      editingCue: cue || null,
      newCueLineId: lineId || null,
      newCueSceneId: sceneId || null,
      newCueSelectedText: selectedText || null,
    }),
  closeCueEditor: () =>
    set({ isCueEditorOpen: false, editingCue: null, newCueLineId: null, newCueSceneId: null, newCueSelectedText: null }),
  addCueToLine: (sceneId, lineId, cue) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId
          ? {
              ...sc,
              lines: sc.lines.map((l) =>
                l.id === lineId
                  ? { ...l, cues: l.cues.some((c) => c.id === cue.id) ? l.cues : [...l.cues, cue] }
                  : l
              ),
            }
          : sc
      ),
    })),
  updateCueInStore: (cueId, updates) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => ({
        ...sc,
        lines: sc.lines.map((l) => ({
          ...l,
          cues: l.cues.map((c) =>
            c.id === cueId ? { ...c, ...updates } : c
          ),
        })),
      })),
    })),
  removeCueFromLine: (sceneId, lineId, cueId) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId
          ? {
              ...sc,
              lines: sc.lines.map((l) =>
                l.id === lineId ? { ...l, cues: l.cues.filter((c) => c.id !== cueId) } : l
              ),
            }
          : sc
      ),
    })),
  reorderCuesInStore: (cueType, orderedCueIds) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => ({
        ...sc,
        lines: sc.lines.map((l) => ({
          ...l,
          cues: l.cues.map((c) => {
            if (c.type !== cueType) return c;
            const idx = orderedCueIds.indexOf(c.id);
            if (idx === -1) return c;
            return { ...c, number: idx + 1, label: c.label.replace(/Q[\d.]+/, `Q${idx + 1}`) };
          }),
        })),
      })),
    })),

  // Settings
  isSettingsOpen: false,
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),

  // Cue panel side
  cuePanelSide: getPersistedCuePanelSide(),
  setCuePanelSide: (side) => {
    try {
      localStorage.setItem("scriptus-cue-panel-side", side);
    } catch {}
    set({ cuePanelSide: side });
  },

  // Script text size
  scriptTextSize: getPersistedScriptTextSize(),
  setScriptTextSize: (size) => {
    try {
      localStorage.setItem("scriptus-text-size", String(size));
    } catch {}
    set({ scriptTextSize: size });
  },

  addScene: (scene, position?: string) =>
    set((s) => {
      if (position === "start") return { scenes: [scene, ...s.scenes] };
      if (position?.startsWith("after-act-") || position?.startsWith("between-")) {
        // Insert sorted by act then scene number
        const newScenes = [...s.scenes, scene];
        newScenes.sort((a, b) => a.act !== b.act ? a.act - b.act : a.scene - b.scene);
        return { scenes: newScenes };
      }
      return { scenes: [...s.scenes, scene] };
    }),
  addLineToScene: (sceneId, line) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, lines: [...sc.lines, line] } : sc
      ),
    })),
  updateSceneTitle: (sceneId, title) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId ? { ...sc, title } : sc
      ),
    })),
  updateLine: (sceneId, lineId, updates) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId
          ? {
              ...sc,
              lines: sc.lines.map((l) =>
                l.id === lineId ? { ...l, ...updates } : l
              ),
            }
          : sc
      ),
    })),
  deleteLine: (sceneId, lineId) =>
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id === sceneId
          ? { ...sc, lines: sc.lines.filter((l) => l.id !== lineId) }
          : sc
      ),
    })),
  deleteScene: (sceneId) =>
    set((s) => ({
      scenes: s.scenes.filter((sc) => sc.id !== sceneId),
    })),

  isCommentPanelOpen: false,
  toggleCommentPanel: () => set((s) => ({ isCommentPanelOpen: !s.isCommentPanelOpen, selectedCommentRef: s.isCommentPanelOpen ? null : s.selectedCommentRef })),
  selectedCommentRef: null,
  setSelectedCommentRef: (ref) => set({ selectedCommentRef: ref }),

  addComment: (lineId, comment) =>
    set((s) => ({
      isCommentPanelOpen: true, // Auto-open panel when a comment is added
      scenes: s.scenes.map((sc) => ({
        ...sc,
        lines: sc.lines.map((l) =>
          l.id === lineId
            ? { ...l, comments: [...(l.comments || []), comment] }
            : l
        ),
      })),
    })),
  resolveComment: (commentId) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => ({
        ...sc,
        lines: sc.lines.map((l) => ({
          ...l,
          comments: (l.comments || []).map((c) =>
            c.id === commentId ? { ...c, resolved: true } : c
          ),
        })),
      })),
    })),
  removeComment: (commentId) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => ({
        ...sc,
        lines: sc.lines.map((l) => ({
          ...l,
          comments: (l.comments || []).filter((c) => c.id !== commentId),
        })),
      })),
    })),

  characterGroups: [],
  ungroupedCharacters: [],
  locations: [],
  setCharacterGroups: (groups) => set({ characterGroups: groups }),
  setUngroupedCharacters: (chars) => set({ ungroupedCharacters: chars }),
  setLocations: (locs) => set({ locations: locs }),

  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  pendingDialogue: null,
  setPendingDialogue: (pd) => set({ pendingDialogue: pd }),

  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),

  remoteCursors: [],
  setRemoteCursors: (cursors) => set({ remoteCursors: cursors }),

  // Stage Manager cue type visibility toggles
  hiddenCueTypes: getPersistedHiddenCueTypes(),
  toggleCueTypeVisibility: (cueType) =>
    set((s) => {
      const newHidden = new Set(s.hiddenCueTypes);
      if (newHidden.has(cueType)) {
        newHidden.delete(cueType);
      } else {
        newHidden.add(cueType);
      }
      try {
        localStorage.setItem("scriptus-hidden-cue-types", JSON.stringify(Array.from(newHidden)));
      } catch {}
      return { hiddenCueTypes: newHidden };
    }),
  isCueTypeVisible: (cueType) => {
    // This is a derived value, but we need to access the store state
    // It will be used via the store selector pattern
    return true; // Placeholder - actual check done via selector
  },

  // Role ordering for "View as" bar
  roleOrder: getPersistedRoleOrder(),
  setRoleOrder: (order) => {
    try {
      localStorage.setItem("scriptus-role-order", JSON.stringify(order));
    } catch {}
    set({ roleOrder: order });
  },

  // Per-role cue bubble visibility
  roleCueBubbles: getPersistedRoleCueBubbles(),
  toggleRoleCueBubbles: (roleId) =>
    set((s) => {
      const newSet = new Set(s.roleCueBubbles);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      try {
        localStorage.setItem("scriptus-role-cue-bubbles", JSON.stringify(Array.from(newSet)));
      } catch {}
      return { roleCueBubbles: newSet };
    }),
  hasRoleCueBubbles: (roleId) => {
    // Placeholder - actual check done via selector
    return true;
  },
}));
