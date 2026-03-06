// ============================================
// SCRIPTUS — Type Definitions
// ============================================

export type ProjectRole =
  | "STAGE_MANAGER"
  | "ACTOR"
  | "LIGHTING"
  | "SOUND"
  | "SET_DESIGN"
  | "PROPS"
  | "DIRECTOR"
  | "WRITER"
  | "VIEWER";

export type CueType =
  | "LIGHT"
  | "SOUND"
  | "PROPS"
  | "SET"
  | "BLOCKING"
  | "PROJECTION"
  | "FLY"
  | "SPOT";

export type CueStatus = "DRAFT" | "REVIEW" | "APPROVED" | "LOCKED";

export type LineType =
  | "STAGE_DIRECTION"
  | "DIALOGUE"
  | "ACT_HEADER"
  | "SCENE_HEADER"
  | "SONG"
  | "TRANSITION"
  | "LOCATION";

// ---- View Models ----

export interface RoleConfig {
  id: ProjectRole;
  label: string;
  icon: string;
  color: string;
  visibleCueTypes: CueType[];
  showAllDialogue: boolean;
  showStageDirections: boolean;
  hasCuePanel: boolean;
}

export interface CueTypeConfig {
  type: CueType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  associatedRole: ProjectRole;
}

export interface CommentView {
  id: string;
  lineId: string | null;
  scriptRef: string | null;
  text: string;
  role: string | null;
  resolved: boolean;
  user: { id: string; name: string; image?: string };
  createdAt: string;
}

export interface ScriptLineView {
  id: string;
  sceneId: string;
  type: LineType;
  character?: string;
  text: string;
  sortOrder: number;
  cues: CueView[];
  comments?: CommentView[];
}

export interface CueView {
  id: string;
  type: CueType;
  label: string;
  number: number;
  note: string;
  scriptRef?: string;
  status: CueStatus;
  lineId: string | null;
  sceneId: string;
  duration?: number;
  preWait?: number;
  followTime?: number;
  createdBy: { name: string; id: string };
  updatedAt: string;
}

export interface SceneView {
  id: string;
  act: number;
  scene: number;
  title: string;
  lines: ScriptLineView[];
}

export interface ProjectView {
  id: string;
  title: string;
  subtitle?: string;
  scenes: SceneView[];
  members: MemberView[];
  customRoles?: CustomRoleView[];
  customCueTypes?: CustomCueTypeView[];
}

export interface MemberView {
  id: string;
  userId: string;
  name: string;
  email: string;
  roles: ProjectRole[];
  character?: string;
  image?: string;
}

// ---- Presence / Collaboration ----

export interface UserPresence {
  userId: string;
  name: string;
  color: string;
  role: ProjectRole;
  cursorLineId?: string;
  lastActive: number;
}

// ---- Custom Roles & Cue Types ----

export interface CustomRoleView {
  id: string;
  name: string;
  icon: string;
  color: string;
  visibleCueTypes: string[];
}

export interface CustomCueTypeView {
  id: string;
  type: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  associatedRole: string;
}

export interface CharacterView {
  id: string;
  name: string;
  groupId: string | null;
  sortOrder: number;
}

export interface CharacterGroupView {
  id: string;
  name: string;
  sortOrder: number;
  characters: CharacterView[];
}

export interface LocationView {
  id: string;
  name: string;
  sortOrder: number;
}

export interface InviteView {
  id: string;
  email: string;
  role: ProjectRole;
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
  sentBy: { name: string };
  createdAt: string;
}

// ---- Cue Editor ----

export interface CueFormData {
  type: CueType;
  label: string;
  number: number;
  note: string;
  status: CueStatus;
  lineId: string | null;
  sceneId: string;
  duration?: number;
  preWait?: number;
  followTime?: number;
}
