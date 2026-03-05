import { create } from "zustand";
import type { ProjectRole, CueType, CueView, SceneView, MemberView } from "@/types";

interface StageStore {
  // Current user context
  activeRole: ProjectRole;
  setActiveRole: (role: ProjectRole) => void;

  // Project data
  projectId: string | null;
  projectTitle: string;
  scenes: SceneView[];
  members: MemberView[];
  setProject: (data: {
    id: string;
    title: string;
    scenes: SceneView[];
    members: MemberView[];
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
  openCueEditor: (cue?: CueView) => void;
  closeCueEditor: () => void;

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

export const useStageStore = create<StageStore>((set) => ({
  // Defaults
  activeRole: "STAGE_MANAGER",
  setActiveRole: (role) => set({ activeRole: role, activeCueId: null }),

  projectId: null,
  projectTitle: "",
  scenes: [],
  members: [],
  setProject: ({ id, title, scenes, members }) =>
    set({ projectId: id, projectTitle: title, scenes, members }),

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
  openCueEditor: (cue) =>
    set({ isCueEditorOpen: true, editingCue: cue || null }),
  closeCueEditor: () => set({ isCueEditorOpen: false, editingCue: null }),

  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),
}));
