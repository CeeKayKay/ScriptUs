import { CueType, CueTypeConfig, ProjectRole } from "@/types";

export const CUE_TYPES: Record<CueType, CueTypeConfig> = {
  LIGHT: {
    type: "LIGHT",
    label: "LX",
    color: "#47B8E8",
    bgColor: "rgba(71, 184, 232, 0.08)",
    borderColor: "rgba(71, 184, 232, 0.25)",
    associatedRole: "LIGHTING",
  },
  SOUND: {
    type: "SOUND",
    label: "SND",
    color: "#E87847",
    bgColor: "rgba(232, 120, 71, 0.08)",
    borderColor: "rgba(232, 120, 71, 0.25)",
    associatedRole: "SOUND",
  },
  PROPS: {
    type: "PROPS",
    label: "PROP",
    color: "#C847E8",
    bgColor: "rgba(200, 71, 232, 0.08)",
    borderColor: "rgba(200, 71, 232, 0.25)",
    associatedRole: "PROPS",
  },
  SET: {
    type: "SET",
    label: "SET",
    color: "#7BE847",
    bgColor: "rgba(123, 232, 71, 0.08)",
    borderColor: "rgba(123, 232, 71, 0.25)",
    associatedRole: "SET_DESIGN",
  },
  BLOCKING: {
    type: "BLOCKING",
    label: "BLK",
    color: "#E8C547",
    bgColor: "rgba(232, 197, 71, 0.08)",
    borderColor: "rgba(232, 197, 71, 0.25)",
    associatedRole: "STAGE_MANAGER",
  },
  PROJECTION: {
    type: "PROJECTION",
    label: "PROJ",
    color: "#47E8D4",
    bgColor: "rgba(71, 232, 212, 0.08)",
    borderColor: "rgba(71, 232, 212, 0.25)",
    associatedRole: "LIGHTING",
  },
  FLY: {
    type: "FLY",
    label: "FLY",
    color: "#A0A0A0",
    bgColor: "rgba(160, 160, 160, 0.08)",
    borderColor: "rgba(160, 160, 160, 0.25)",
    associatedRole: "STAGE_MANAGER",
  },
  SPOT: {
    type: "SPOT",
    label: "SPOT",
    color: "#E8E847",
    bgColor: "rgba(232, 232, 71, 0.08)",
    borderColor: "rgba(232, 232, 71, 0.25)",
    associatedRole: "LIGHTING",
  },
};

export const CUE_TYPE_LIST = Object.values(CUE_TYPES);

export function getCueTypesForRole(role: ProjectRole): CueType[] {
  return CUE_TYPE_LIST.filter((ct) => ct.associatedRole === role).map(
    (ct) => ct.type
  );
}
