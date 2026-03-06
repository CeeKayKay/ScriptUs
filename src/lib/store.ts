import { create } from "zustand";
import type { ProjectRole, CueType, CueView, SceneView, ScriptLineView, MemberView, CustomRoleView, CustomCueTypeView, CueStatus, CommentView } from "@/types";

type CuePanelSide = "left" | "right";

interface StageStore {
  // Current user context
  activeRole: ProjectRole;
  setActiveRole: (role: ProjectRole) => void;

  // Project data
  projectId: string | null;
  projectTitle: string;
  scenes: SceneView[];
  members: MemberView[];
  customRoles: CustomRoleView[];
  customCueTypes: CustomCueTypeView[];
  setProject: (data: {
    id: string;
    title: string;
    scenes: SceneView[];
    members: MemberView[];
    customRoles?: CustomRoleView[];
    customCueTypes?: CustomCueTypeView[];
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
  addScene: (scene: SceneView) => void;
  addLineToScene: (sceneId: string, line: ScriptLineView) => void;
  updateSceneTitle: (sceneId: string, title: string) => void;
  updateLine: (sceneId: string, lineId: string, updates: Partial<ScriptLineView>) => void;
  deleteLine: (sceneId: string, lineId: string) => void;
  deleteScene: (sceneId: string) => void;

  // Comments
  addComment: (lineId: string, comment: CommentView) => void;
  resolveComment: (commentId: string) => void;
  removeComment: (commentId: string) => void;

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

function getPersistedActiveRole(): ProjectRole {
  if (typeof window === "undefined") return "STAGE_MANAGER";
  try {
    const saved = localStorage.getItem("scriptus-active-role");
    if (saved) return saved as ProjectRole;
  } catch {}
  return "STAGE_MANAGER";
}

export const useStageStore = create<StageStore>((set) => ({
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
  setProject: ({ id, title, scenes, members, customRoles, customCueTypes }) =>
    set({
      projectId: id,
      projectTitle: title,
      scenes,
      members,
      customRoles: customRoles || [],
      customCueTypes: customCueTypes || [],
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
                l.id === lineId ? { ...l, cues: [...l.cues, cue] } : l
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

  addScene: (scene) =>
    set((s) => ({ scenes: [...s.scenes, scene] })),
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

  addComment: (lineId, comment) =>
    set((s) => ({
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

  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),
}));
