"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { signOut } from "next-auth/react";
import { useStageStore } from "@/lib/store";
import { ROLE_LIST } from "@/lib/roles";
import { CUE_TYPE_LIST, CUE_TYPES, getEffectiveCueTypes } from "@/lib/cue-types";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTheme } from "@/hooks/useTheme";
import type { ProjectRole, CustomRoleView, CustomCueTypeView } from "@/types";

interface SettingsProps {
  projectId: string;
  myRoles: ProjectRole[];
}

import type { InviteView } from "@/types";

type SettingsTab = "preferences" | "team" | "roles" | "cue-types" | "email";

const ADMIN_ROLES: ProjectRole[] = ["STAGE_MANAGER", "DIRECTOR"];

const PRESET_COLORS = [
  "#E8C547", "#47B8E8", "#E87847", "#7BE847", "#C847E8",
  "#47E8D4", "#E8E847", "#A0A0A0", "#E84747", "#47E88A",
];

const PRESET_ICONS = ["●", "◆", "◎", "✦", "▧", "☀", "♫", "★", "▲", "◌"];

const inputStyle = {
  fontFamily: "DM Mono, monospace",
  fontSize: 16,
  background: "var(--stage-bg)",
  border: "1px solid var(--stage-border)",
  color: "var(--stage-text)",
  outline: "none",
} as const;

const labelStyle = {
  fontFamily: "DM Mono, monospace",
  fontSize: 15,
  color: "var(--stage-text)",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
} as const;

export function Settings({ projectId, myRoles }: SettingsProps) {
  const {
    closeSettings,
    cuePanelSide,
    setCuePanelSide,
    scriptTextSize,
    setScriptTextSize,
    customRoles,
    customCueTypes,
    members,
    cueTypeColorOverrides,
    cueTypeColorOverridesLight,
    setCueTypeColorOverride,
    roleOrder,
    setRoleOrder,
  } = useStageStore();

  const { theme, toggleTheme } = useTheme();
  const isAdmin = myRoles.some((r) => ADMIN_ROLES.includes(r));
  const isSM = myRoles.includes("STAGE_MANAGER");
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");

  // --- Add Role form ---
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleIcon, setNewRoleIcon] = useState("●");
  const [newRoleColor, setNewRoleColor] = useState("#888888");
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // --- Add Cue Type form ---
  const [newCueLabel, setNewCueLabel] = useState("");
  const [newCueType, setNewCueType] = useState("");
  const [newCueColor, setNewCueColor] = useState("#888888");
  const [newCueRole, setNewCueRole] = useState("");
  const [cueSaving, setCueSaving] = useState(false);
  const [cueError, setCueError] = useState<string | null>(null);

  // --- Invite state ---
  const [invites, setInvites] = useState<InviteView[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ProjectRole>("ACTOR");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [invitesLoaded, setInvitesLoaded] = useState(false);

  const [showAddRole, setShowAddRole] = useState(false);
  const [showAddCueType, setShowAddCueType] = useState(false);

  // --- Built-in cue type color editing ---
  const [editingBuiltinCueType, setEditingBuiltinCueType] = useState<string | null>(null);
  const [builtinCueColorSaving, setBuiltinCueColorSaving] = useState(false);
  const effectiveCueTypesDark = getEffectiveCueTypes(cueTypeColorOverrides);
  const effectiveCueTypesLight = getEffectiveCueTypes(cueTypeColorOverridesLight);
  // Show colors for current theme
  const effectiveCueTypes = theme === "light" ? effectiveCueTypesLight : effectiveCueTypesDark;

  // --- SMTP state ---
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpLoaded, setSmtpLoaded] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<string | null>(null);

  // --- Edit state ---
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleIcon, setEditRoleIcon] = useState("●");
  const [editRoleColor, setEditRoleColor] = useState("#888888");

  const [editingCueTypeId, setEditingCueTypeId] = useState<string | null>(null);
  const [editCueLabel, setEditCueLabel] = useState("");
  const [editCueTypeKey, setEditCueTypeKey] = useState("");
  const [editCueColor, setEditCueColor] = useState("#888888");
  const [editCueRole, setEditCueRole] = useState("");

  const startEditRole = (role: CustomRoleView) => {
    setEditingRoleId(role.id);
    setEditRoleName(role.name);
    setEditRoleIcon(role.icon);
    setEditRoleColor(role.color);
    setRoleError(null);
  };

  const startEditCueType = (ct: CustomCueTypeView) => {
    setEditingCueTypeId(ct.id);
    setEditCueLabel(ct.label);
    setEditCueTypeKey(ct.type);
    setEditCueColor(ct.color);
    setEditCueRole(ct.associatedRole);
    setCueError(null);
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    setRoleSaving(true);
    setRoleError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName.trim(),
          icon: newRoleIcon,
          color: newRoleColor,
          visibleCueTypes: [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create role");
      }

      setNewRoleName("");
      setNewRoleIcon("●");
      setNewRoleColor("#888888");
      setShowAddRole(false);
      window.location.reload();
    } catch (e: any) {
      setRoleError(e.message);
    } finally {
      setRoleSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRoleId || !editRoleName.trim()) return;
    setRoleSaving(true);
    setRoleError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRoleId,
          name: editRoleName.trim(),
          icon: editRoleIcon,
          color: editRoleColor,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }

      setEditingRoleId(null);
      window.location.reload();
    } catch (e: any) {
      setRoleError(e.message);
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Delete this role? This cannot be undone.")) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/roles?roleId=${roleId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete role");
      }

      window.location.reload();
    } catch (e: any) {
      setRoleError(e.message);
    }
  };

  const handleBuiltinCueColorChange = async (cueType: string, color: string, colorTheme: "dark" | "light") => {
    setBuiltinCueColorSaving(true);
    try {
      const source = colorTheme === "light" ? cueTypeColorOverridesLight : cueTypeColorOverrides;
      const newOverrides = { ...source, [cueType]: color };
      const field = colorTheme === "light" ? "cueTypeColorsLight" : "cueTypeColors";
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newOverrides }),
      });
      if (res.ok) {
        setCueTypeColorOverride(cueType, color, colorTheme);
      }
    } catch {}
    setBuiltinCueColorSaving(false);
  };

  const handleResetBuiltinCueColor = async (cueType: string, colorTheme: "dark" | "light") => {
    setBuiltinCueColorSaving(true);
    try {
      const source = colorTheme === "light" ? cueTypeColorOverridesLight : cueTypeColorOverrides;
      const newOverrides = { ...source };
      delete newOverrides[cueType];
      const field = colorTheme === "light" ? "cueTypeColorsLight" : "cueTypeColors";
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newOverrides }),
      });
      if (res.ok) {
        if (colorTheme === "light") {
          useStageStore.getState().setCueTypeColorOverridesLight(newOverrides);
        } else {
          useStageStore.getState().setCueTypeColorOverrides(newOverrides);
        }
      }
    } catch {}
    setBuiltinCueColorSaving(false);
  };

  const handleAddCueType = async () => {
    if (!newCueLabel.trim() || !newCueType.trim()) return;
    setCueSaving(true);
    setCueError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/cue-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newCueType.trim().toUpperCase().replace(/\s+/g, "_"),
          label: newCueLabel.trim(),
          color: newCueColor,
          bgColor: `${newCueColor}14`,
          borderColor: `${newCueColor}40`,
          associatedRole: newCueRole || "STAGE_MANAGER",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create cue type");
      }

      setNewCueLabel("");
      setNewCueType("");
      setNewCueColor("#888888");
      setNewCueRole("");
      setShowAddCueType(false);
      window.location.reload();
    } catch (e: any) {
      setCueError(e.message);
    } finally {
      setCueSaving(false);
    }
  };

  const handleUpdateCueType = async () => {
    if (!editingCueTypeId || !editCueLabel.trim() || !editCueTypeKey.trim()) return;
    setCueSaving(true);
    setCueError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/cue-types`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCueTypeId,
          type: editCueTypeKey.trim().toUpperCase().replace(/\s+/g, "_"),
          label: editCueLabel.trim(),
          color: editCueColor,
          bgColor: `${editCueColor}14`,
          borderColor: `${editCueColor}40`,
          associatedRole: editCueRole || "STAGE_MANAGER",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update cue type");
      }

      setEditingCueTypeId(null);
      window.location.reload();
    } catch (e: any) {
      setCueError(e.message);
    } finally {
      setCueSaving(false);
    }
  };

  const handleDeleteCueType = async (cueTypeId: string) => {
    if (!confirm("Delete this cue type? This cannot be undone.")) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/cue-types?cueTypeId=${cueTypeId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete cue type");
      }

      window.location.reload();
    } catch (e: any) {
      setCueError(e.message);
    }
  };

  // Load SMTP settings when email tab is opened
  useEffect(() => {
    if (activeTab !== "email" || !isSM || smtpLoaded) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/settings`);
        if (res.ok) {
          const data = await res.json();
          setSmtpUser(data.smtpUser || "");
          if (data.smtpConfigured) setSmtpPass("••••••••");
        }
      } catch {}
      setSmtpLoaded(true);
    })();
  }, [activeTab, isAdmin, smtpLoaded, projectId]);

  // Load invites when team tab is opened
  useEffect(() => {
    if (activeTab !== "team" || !isAdmin || invitesLoaded) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/invites`);
        if (res.ok) {
          const data = await res.json();
          setInvites(data.invites || []);
        }
      } catch {}
      setInvitesLoaded(true);
    })();
  }, [activeTab, isAdmin, invitesLoaded, projectId]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invite");
      }

      const invite = await res.json();
      setInvites((prev) => [invite, ...prev]);
      setInviteEmail("");
      setInviteSuccess(`Invitation sent to ${invite.email}`);
      setTimeout(() => setInviteSuccess(null), 4000);
    } catch (e: any) {
      setInviteError(e.message);
    } finally {
      setInviteSending(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/invites?inviteId=${inviteId}`, {
        method: "DELETE",
      });
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch {}
  };

  // Local member state for optimistic UI updates (no useEffect sync — updates happen locally)
  const [localMembers, setLocalMembers] = useState(members);

  const handleUpdateMemberRoles = async (memberId: string, roles: ProjectRole[]) => {
    if (roles.length === 0) return;
    const prev = localMembers;
    // Optimistic update
    setLocalMembers((members) =>
      members.map((m) => (m.id === memberId ? { ...m, roles } : m))
    );
    try {
      const res = await fetch(`/api/projects/${projectId}/invites`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, roles }),
      });
      if (!res.ok) {
        // Revert on failure
        setLocalMembers(prev);
      }
    } catch {
      setLocalMembers(prev);
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from this production? They will lose access.`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/invites`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, action: "remove" }),
      });
      if (res.ok) {
        setLocalMembers((prev) => prev.filter((m) => m.id !== memberId));
      }
    } catch {}
  };

  const tabs: { id: SettingsTab; label: string; visible: boolean }[] = [
    { id: "preferences", label: "Preferences", visible: true },
    { id: "team", label: "Team", visible: true },
    { id: "roles", label: "Roles", visible: isAdmin },
    { id: "cue-types", label: "Cue Types", visible: isAdmin },
    { id: "email", label: "Email", visible: isSM },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--stage-overlay)" }}
    >
      <div
        className="w-full animate-fade-in"
        style={{
          background: "var(--stage-surface)",
          border: isMobile ? "none" : "1px solid var(--stage-border)",
          boxShadow: isMobile ? "none" : "0 25px 50px var(--stage-overlay)",
          borderRadius: isMobile ? 0 : 12,
          maxWidth: isMobile ? "100%" : "36rem",
          maxHeight: isMobile ? "100%" : "80vh",
          height: isMobile ? "100%" : "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--stage-border)" }}
        >
          <h2
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: 22,
              fontWeight: 600,
              color: "var(--stage-text)",
            }}
          >
            Settings
          </h2>
          <button
            onClick={closeSettings}
            className="text-sm px-2 py-1 rounded hover:bg-white/5"
            style={{ fontFamily: "DM Mono, monospace", color: "var(--stage-muted)" }}
          >
            X
          </button>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-1 px-6 py-2 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--stage-border)" }}
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-1.5 rounded-md transition-all"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? "var(--stage-gold)" : "var(--stage-text)",
                background: activeTab === tab.id ? "#E8C54712" : "transparent",
                border:
                  activeTab === tab.id
                    ? "1px solid #E8C54740"
                    : "1px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ===== PREFERENCES TAB ===== */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              {/* Theme toggle */}
              <div>
                <label className="block mb-2" style={labelStyle}>
                  Appearance
                </label>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { if (theme !== t) toggleTheme(); }}
                      className="flex-1 px-4 py-3 rounded-lg transition-all"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 14,
                        fontWeight: theme === t ? 700 : 400,
                        color: theme === t ? "var(--stage-gold)" : "var(--stage-dim)",
                        background: theme === t ? "var(--stage-gold-bg)" : "var(--stage-hover)",
                        border: `1px solid ${theme === t ? "var(--stage-gold-border)" : "var(--stage-border-subtle)"}`,
                        textTransform: "capitalize",
                      }}
                    >
                      {t === "dark" ? "Dark" : "Light"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2" style={labelStyle}>
                  Cue Panel Position
                </label>
                <p
                  className="mb-3"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 13,
                    color: "var(--stage-dim)",
                  }}
                >
                  Choose which side the cue panel appears on for operator roles.
                </p>
                <div className="flex gap-2">
                  {(["left", "right"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setCuePanelSide(side)}
                      className="flex-1 px-4 py-3 rounded-lg transition-all"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 14,
                        fontWeight: cuePanelSide === side ? 700 : 400,
                        color: cuePanelSide === side ? "var(--stage-gold)" : "var(--stage-dim)",
                        background:
                          cuePanelSide === side
                            ? "#E8C54712"
                            : "var(--stage-line-hover)",
                        border: `1px solid ${
                          cuePanelSide === side ? "#E8C54740" : "var(--stage-border-subtle)"
                        }`,
                        textTransform: "capitalize",
                      }}
                    >
                      {side === "left" ? "Left" : "Right"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Script Text Size */}
              <div>
                <label className="block mb-2" style={labelStyle}>
                  Script Text Size
                </label>
                <p
                  className="mb-3"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 13,
                    color: "var(--stage-dim)",
                  }}
                >
                  Adjust the size of dialogue and script text.
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={12}
                    max={36}
                    step={1}
                    value={scriptTextSize}
                    onChange={(e) => setScriptTextSize(Number(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: "var(--stage-gold)" }}
                  />
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--stage-gold)",
                      minWidth: 40,
                      textAlign: "center",
                    }}
                  >
                    {scriptTextSize}px
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  {[14, 18, 20, 24, 28].map((size) => (
                    <button
                      key={size}
                      onClick={() => setScriptTextSize(size)}
                      className="px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: 13,
                        fontWeight: scriptTextSize === size ? 700 : 400,
                        color: scriptTextSize === size ? "var(--stage-gold)" : "var(--stage-dim)",
                        background:
                          scriptTextSize === size
                            ? "#E8C54712"
                            : "var(--stage-line-hover)",
                        border: `1px solid ${
                          scriptTextSize === size ? "#E8C54740" : "var(--stage-border-subtle)"
                        }`,
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div
                  className="mt-3 px-4 py-3 rounded-lg"
                  style={{
                    background: "var(--stage-line-hover)",
                    border: "1px solid var(--stage-border)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 12,
                      color: "var(--stage-faint)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Preview
                  </span>
                  <div
                    style={{
                      fontFamily: "Libre Baskerville, serif",
                      fontSize: scriptTextSize,
                      color: "#ffffff",
                      lineHeight: 1.75,
                      marginTop: 4,
                    }}
                  >
                    To be, or not to be, that is the question.
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ===== TEAM TAB ===== */}
          {activeTab === "team" && (
            <div className="space-y-4">
              <p style={{ fontFamily: "DM Mono, monospace", fontSize: 15, color: "var(--stage-text)" }}>
                {isAdmin ? "Manage team members and send invitations." : "Production team members."}
              </p>

              {/* Invite form — admin only */}
              {isAdmin && (
                <div
                  className="p-4 rounded-lg space-y-3"
                  style={{ background: "var(--stage-line-hover)", border: "1px solid var(--stage-border)" }}
                >
                  <div style={labelStyle}>Invite Collaborator</div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="flex-1 px-3 py-2 rounded"
                      style={inputStyle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendInvite();
                      }}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                      className="px-2 py-2 rounded"
                      style={inputStyle}
                    >
                      {ROLE_LIST.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSendInvite}
                    disabled={inviteSending || !inviteEmail.trim()}
                    className="px-4 py-2 rounded transition-colors"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--stage-gold)",
                      background: "#E8C54715",
                      border: "1px solid #E8C54740",
                      opacity: inviteSending || !inviteEmail.trim() ? 0.5 : 1,
                    }}
                  >
                    {inviteSending ? "Sending..." : "Send Invite"}
                  </button>
                  {inviteError && (
                    <div style={{ fontFamily: "DM Mono, monospace", fontSize: 14, color: "var(--stage-danger)" }}>
                      {inviteError}
                    </div>
                  )}
                  {inviteSuccess && (
                    <div style={{ fontFamily: "DM Mono, monospace", fontSize: 14, color: "var(--stage-success)" }}>
                      {inviteSuccess}
                    </div>
                  )}
                </div>
              )}

              {/* Current members */}
              <div>
                <div className="mb-2" style={labelStyle}>Members</div>
                <div className="space-y-2">
                  {localMembers.map((m) => (
                    <div
                      key={m.id}
                      className="px-4 py-3 rounded-lg"
                      style={{ background: "var(--stage-line-hover)", border: "1px solid #222" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                          style={{
                            fontSize: 12,
                            background: "rgba(232,197,71,0.1)",
                            border: "1px solid #E8C54740",
                            color: "var(--stage-gold)",
                            fontFamily: "DM Mono, monospace",
                          }}
                        >
                          {(m.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 14, color: "var(--stage-text)", fontWeight: 600 }}>
                            {m.name}
                          </div>
                          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 13, color: "var(--stage-text)" }}>
                            {m.email}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.name)}
                            className="px-2 py-1 rounded hover:bg-red-500/10 transition-colors flex-shrink-0"
                            style={{ fontFamily: "DM Mono, monospace", fontSize: 13, color: "var(--stage-error)", border: "1px solid #E8474730" }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {/* Role badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-12">
                        {isAdmin ? (
                          ROLE_LIST.map((r) => {
                            const hasRole = m.roles.includes(r.id);
                            return (
                              <button
                                key={r.id}
                                onClick={() => {
                                  const newRoles = hasRole
                                    ? m.roles.filter((x: ProjectRole) => x !== r.id)
                                    : [...m.roles, r.id];
                                  if (newRoles.length > 0) handleUpdateMemberRoles(m.id, newRoles as ProjectRole[]);
                                }}
                                className="px-2.5 py-1 rounded transition-all"
                                style={{
                                  fontFamily: "DM Mono, monospace",
                                  fontSize: 13,
                                  color: hasRole ? r.color : "var(--stage-text)",
                                  background: hasRole ? r.color + "15" : "transparent",
                                  border: `1px solid ${hasRole ? r.color + "40" : "var(--stage-border-subtle)"}`,
                                }}
                              >
                                {r.icon} {r.label}
                              </button>
                            );
                          })
                        ) : (
                          m.roles.map((roleId: ProjectRole) => {
                            const r = ROLE_LIST.find((rl) => rl.id === roleId);
                            if (!r) return null;
                            return (
                              <span
                                key={r.id}
                                className="px-2.5 py-1 rounded"
                                style={{
                                  fontFamily: "DM Mono, monospace",
                                  fontSize: 13,
                                  color: r.color,
                                  background: r.color + "15",
                                  border: `1px solid ${r.color}40`,
                                }}
                              >
                                {r.icon} {r.label}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending invites — admin only */}
              {isAdmin && invites.filter((i) => i.status === "PENDING").length > 0 && (
                <div>
                  <div className="mb-2" style={labelStyle}>Pending Invites</div>
                  <div className="space-y-1.5">
                    {invites.filter((i) => i.status === "PENDING").map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg group"
                        style={{ background: "var(--stage-line-hover)", border: "1px dashed var(--stage-border)" }}
                      >
                        <div style={{ fontFamily: "DM Mono, monospace", fontSize: 14, color: "var(--stage-text)", flex: 1 }}>
                          {inv.email}
                        </div>
                        <span style={{ fontFamily: "DM Mono, monospace", fontSize: 13, color: "var(--stage-gold)" }}>
                          {inv.role.replace(/_/g, " ")}
                        </span>
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded hover:bg-red-500/10"
                          style={{ fontFamily: "DM Mono, monospace", fontSize: 13, color: "var(--stage-error)", border: "1px solid #E8474740" }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== ROLES TAB ===== */}
          {activeTab === "roles" && isAdmin && (
            <RolesTabContent
              theme={theme}
              customRoles={customRoles}
              roleOrder={roleOrder}
              setRoleOrder={setRoleOrder}
              roleError={roleError}
              setRoleError={setRoleError}
              editingRoleId={editingRoleId}
              setEditingRoleId={setEditingRoleId}
              editRoleName={editRoleName}
              editRoleIcon={editRoleIcon}
              editRoleColor={editRoleColor}
              setEditRoleName={setEditRoleName}
              setEditRoleIcon={setEditRoleIcon}
              setEditRoleColor={setEditRoleColor}
              roleSaving={roleSaving}
              handleUpdateRole={handleUpdateRole}
              handleDeleteRole={handleDeleteRole}
              startEditRole={startEditRole}
              showAddRole={showAddRole}
              setShowAddRole={setShowAddRole}
              newRoleName={newRoleName}
              newRoleIcon={newRoleIcon}
              newRoleColor={newRoleColor}
              setNewRoleName={setNewRoleName}
              setNewRoleIcon={setNewRoleIcon}
              setNewRoleColor={setNewRoleColor}
              handleAddRole={handleAddRole}
            />
          )}

          {/* ===== CUE TYPES TAB ===== */}
          {activeTab === "cue-types" && isAdmin && (
            <div className="space-y-4">
              <p
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 15,
                  color: "var(--stage-text)",
                }}
              >
                Manage cue types for this project.
              </p>

              {/* Built-in cue types */}
              <div>
                <div
                  className="mb-2"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 13,
                    color: "var(--stage-text)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Built-in Cue Types
                </div>
                <div className="space-y-1.5">
                  {CUE_TYPE_LIST.map((ct) => {
                    const eff = effectiveCueTypes[ct.type];
                    const effDark = effectiveCueTypesDark[ct.type];
                    const effLight = effectiveCueTypesLight[ct.type];
                    const isEditing = editingBuiltinCueType === ct.type;
                    const hasDarkOverride = ct.type in cueTypeColorOverrides;
                    const hasLightOverride = ct.type in cueTypeColorOverridesLight;
                    const hasOverride = hasDarkOverride || hasLightOverride;
                    return (
                      <div key={ct.type}>
                        <div
                          className="flex items-center gap-3 px-3 py-2 rounded-lg group cursor-pointer"
                          style={{
                            background: eff.bgColor,
                            border: `1px solid ${eff.borderColor}`,
                          }}
                          onClick={() => setEditingBuiltinCueType(isEditing ? null : ct.type)}
                        >
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm"
                            style={{
                              background: eff.color + "40",
                              border: `1px solid ${eff.color}`,
                            }}
                          />
                          <span
                            style={{
                              fontFamily: "DM Mono, monospace",
                              fontSize: 14,
                              fontWeight: 700,
                              color: eff.color,
                            }}
                          >
                            {ct.label}
                          </span>
                          <span
                            style={{
                              fontFamily: "DM Mono, monospace",
                              fontSize: 12,
                              color: "var(--stage-text)",
                            }}
                          >
                            ({ct.type})
                          </span>
                          <span className="ml-auto flex items-center gap-2">
                            {hasOverride && (
                              <span
                                style={{
                                  fontFamily: "DM Mono, monospace",
                                  fontSize: 10,
                                  color: "var(--stage-muted)",
                                  fontStyle: "italic",
                                }}
                              >
                                customized
                              </span>
                            )}
                            <span
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{
                                fontFamily: "DM Mono, monospace",
                                fontSize: 11,
                                color: "var(--stage-text)",
                                border: "1px solid var(--stage-border-subtle)",
                                borderRadius: 4,
                                padding: "1px 6px",
                              }}
                            >
                              {isEditing ? "Close" : "Edit Color"}
                            </span>
                          </span>
                        </div>
                        {isEditing && (
                          <div
                            className="mt-1 px-3 py-3 rounded-lg space-y-4"
                            style={{
                              background: "var(--stage-surface)",
                              border: "1px solid var(--stage-border-subtle)",
                            }}
                          >
                            {/* Dark theme color */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span style={{ ...labelStyle, fontSize: 12 }}>Dark Theme</span>
                                <span
                                  className="inline-block w-3 h-3 rounded-sm"
                                  style={{ background: effDark.color, border: `1px solid ${effDark.color}80` }}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {PRESET_COLORS.map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => handleBuiltinCueColorChange(ct.type, c, "dark")}
                                    disabled={builtinCueColorSaving}
                                    className="w-7 h-7 rounded-md transition-transform hover:scale-110"
                                    style={{
                                      background: c,
                                      border: effDark.color === c ? "2px solid white" : "2px solid transparent",
                                      boxShadow: effDark.color === c ? `0 0 0 1px ${c}` : "none",
                                      cursor: "pointer",
                                      opacity: builtinCueColorSaving ? 0.5 : 1,
                                    }}
                                    title={c}
                                  />
                                ))}
                                <input
                                  type="color"
                                  value={effDark.color}
                                  onChange={(e) => handleBuiltinCueColorChange(ct.type, e.target.value, "dark")}
                                  disabled={builtinCueColorSaving}
                                  className="w-7 h-7 rounded-md cursor-pointer"
                                  style={{ border: "2px solid var(--stage-border)", padding: 0, background: "none" }}
                                  title="Custom color"
                                />
                              </div>
                              {hasDarkOverride && (
                                <button
                                  onClick={() => handleResetBuiltinCueColor(ct.type, "dark")}
                                  disabled={builtinCueColorSaving}
                                  style={{
                                    fontFamily: "DM Mono, monospace", fontSize: 11, color: "var(--stage-muted)",
                                    background: "none", border: "1px solid var(--stage-border-subtle)",
                                    borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                                    opacity: builtinCueColorSaving ? 0.5 : 1,
                                  }}
                                >
                                  Reset ({CUE_TYPES[ct.type].color})
                                </button>
                              )}
                            </div>
                            {/* Light theme color */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span style={{ ...labelStyle, fontSize: 12 }}>Light Theme</span>
                                <span
                                  className="inline-block w-3 h-3 rounded-sm"
                                  style={{ background: effLight.color, border: `1px solid ${effLight.color}80` }}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {PRESET_COLORS.map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => handleBuiltinCueColorChange(ct.type, c, "light")}
                                    disabled={builtinCueColorSaving}
                                    className="w-7 h-7 rounded-md transition-transform hover:scale-110"
                                    style={{
                                      background: c,
                                      border: effLight.color === c ? "2px solid #333" : "2px solid transparent",
                                      boxShadow: effLight.color === c ? `0 0 0 1px ${c}` : "none",
                                      cursor: "pointer",
                                      opacity: builtinCueColorSaving ? 0.5 : 1,
                                    }}
                                    title={c}
                                  />
                                ))}
                                <input
                                  type="color"
                                  value={effLight.color}
                                  onChange={(e) => handleBuiltinCueColorChange(ct.type, e.target.value, "light")}
                                  disabled={builtinCueColorSaving}
                                  className="w-7 h-7 rounded-md cursor-pointer"
                                  style={{ border: "2px solid var(--stage-border)", padding: 0, background: "none" }}
                                  title="Custom color"
                                />
                              </div>
                              {hasLightOverride && (
                                <button
                                  onClick={() => handleResetBuiltinCueColor(ct.type, "light")}
                                  disabled={builtinCueColorSaving}
                                  style={{
                                    fontFamily: "DM Mono, monospace", fontSize: 11, color: "var(--stage-muted)",
                                    background: "none", border: "1px solid var(--stage-border-subtle)",
                                    borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                                    opacity: builtinCueColorSaving ? 0.5 : 1,
                                  }}
                                >
                                  Reset ({CUE_TYPES[ct.type].color})
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom cue types section */}
              <div>
                <div
                  className="mb-2"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 13,
                    color: "var(--stage-text)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Custom Cue Types
                </div>

              {cueError && (
                <div
                  className="px-3 py-2 rounded text-sm"
                  style={{
                    background: "rgba(232, 120, 71, 0.1)",
                    border: "1px solid rgba(232, 120, 71, 0.3)",
                    color: "var(--stage-danger)",
                    fontFamily: "DM Mono, monospace",
                    fontSize: 12,
                  }}
                >
                  {cueError}
                </div>
              )}

              {/* Existing custom cue types */}
              {customCueTypes.length > 0 && (
                <div className="space-y-2">
                  {customCueTypes.map((ct) =>
                    editingCueTypeId === ct.id ? (
                      <CueTypeEditForm
                        key={ct.id}
                        label={editCueLabel}
                        typeKey={editCueTypeKey}
                        color={editCueColor}
                        role={editCueRole}
                        saving={cueSaving}
                        onLabelChange={setEditCueLabel}
                        onTypeKeyChange={setEditCueTypeKey}
                        onColorChange={setEditCueColor}
                        onRoleChange={setEditCueRole}
                        onSave={handleUpdateCueType}
                        onCancel={() => { setEditingCueTypeId(null); setCueError(null); }}
                      />
                    ) : (
                      <div
                        key={ct.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
                        style={{
                          background: ct.bgColor,
                          border: `1px solid ${ct.borderColor}`,
                        }}
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm"
                          style={{
                            background: ct.color + "40",
                            border: `1px solid ${ct.color}`,
                          }}
                        />
                        <span
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 14,
                            fontWeight: 700,
                            color: ct.color,
                          }}
                        >
                          {ct.label}
                        </span>
                        <span
                          className="flex-1"
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 12,
                            color: "var(--stage-text)",
                          }}
                        >
                          ({ct.type})
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditCueType(ct)}
                            className="px-2 py-1 rounded hover:bg-white/5"
                            style={{
                              fontFamily: "DM Mono, monospace",
                              fontSize: 13,
                              color: "var(--stage-text)",
                              border: "1px solid var(--stage-border-subtle)",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCueType(ct.id)}
                            className="px-2 py-1 rounded hover:bg-red-500/10"
                            style={{
                              fontFamily: "DM Mono, monospace",
                              fontSize: 13,
                              color: "var(--stage-error)",
                              border: "1px solid #E8474740",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {customCueTypes.length === 0 && !showAddCueType && (
                <div
                  className="text-center py-6"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 14,
                    color: "var(--stage-text)",
                  }}
                >
                  No custom cue types yet
                </div>
              )}

              {/* Add cue type form */}
              {showAddCueType ? (
                <CueTypeEditForm
                  label={newCueLabel}
                  typeKey={newCueType}
                  color={newCueColor}
                  role={newCueRole}
                  saving={cueSaving}
                  onLabelChange={setNewCueLabel}
                  onTypeKeyChange={setNewCueType}
                  onColorChange={setNewCueColor}
                  onRoleChange={setNewCueRole}
                  onSave={handleAddCueType}
                  onCancel={() => { setShowAddCueType(false); setCueError(null); }}
                  saveLabel="Add Cue Type"
                />
              ) : (
                <button
                  onClick={() => setShowAddCueType(true)}
                  className="w-full px-4 py-2.5 rounded-lg transition-colors hover:bg-white/3"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 14,
                    color: "var(--stage-text)",
                    border: "1px dashed var(--stage-border-subtle)",
                  }}
                >
                  + Add Custom Cue Type
                </button>
              )}
              </div>
            </div>
          )}

          {/* ===== EMAIL TAB ===== */}
          {activeTab === "email" && isSM && (
            <div className="space-y-4">
              <p style={{ fontFamily: "DM Mono, monospace", fontSize: 15, color: "var(--stage-text)" }}>
                Configure Gmail SMTP to send invite emails from your own address.
              </p>

              <div
                className="p-4 rounded-lg space-y-3"
                style={{ background: "var(--stage-line-hover)", border: "1px solid var(--stage-border)" }}
              >
                <div style={labelStyle}>Gmail SMTP Setup</div>

                <p style={{ fontFamily: "DM Mono, monospace", fontSize: 13, color: "var(--stage-text)", lineHeight: 1.5 }}>
                  Use a Gmail App Password (not your regular password).
                  Go to Google Account → Security → 2-Step Verification → App Passwords to generate one.
                </p>

                <div>
                  <label className="block mb-1.5" style={labelStyle}>Gmail Address</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full px-3 py-2 rounded"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block mb-1.5" style={labelStyle}>App Password</label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="16-character app password"
                    className="w-full px-3 py-2 rounded"
                    style={inputStyle}
                    onFocus={() => { if (smtpPass === "••••••••") setSmtpPass(""); }}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={async () => {
                      setSmtpSaving(true);
                      setSmtpStatus(null);
                      try {
                        const body: Record<string, string> = { smtpUser };
                        if (smtpPass && smtpPass !== "••••••••") body.smtpPass = smtpPass;
                        const res = await fetch(`/api/projects/${projectId}/settings`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        if (res.ok) {
                          setSmtpStatus("Saved successfully");
                          if (smtpPass && smtpPass !== "••••••••") setSmtpPass("••••••••");
                        } else {
                          setSmtpStatus("Failed to save");
                        }
                      } catch {
                        setSmtpStatus("Failed to save");
                      }
                      setSmtpSaving(false);
                      setTimeout(() => setSmtpStatus(null), 3000);
                    }}
                    disabled={smtpSaving || !smtpUser.trim()}
                    className="px-4 py-2 rounded transition-colors"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--stage-gold)",
                      background: "#E8C54715",
                      border: "1px solid #E8C54740",
                      opacity: smtpSaving || !smtpUser.trim() ? 0.5 : 1,
                    }}
                  >
                    {smtpSaving ? "Saving..." : "Save SMTP Settings"}
                  </button>
                  <button
                    onClick={async () => {
                      setSmtpSaving(true);
                      setSmtpStatus(null);
                      try {
                        await fetch(`/api/projects/${projectId}/settings`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ smtpUser: "", smtpPass: "" }),
                        });
                        setSmtpUser("");
                        setSmtpPass("");
                        setSmtpStatus("SMTP settings cleared");
                      } catch {
                        setSmtpStatus("Failed to clear");
                      }
                      setSmtpSaving(false);
                      setTimeout(() => setSmtpStatus(null), 3000);
                    }}
                    className="px-4 py-2 rounded transition-colors hover:bg-white/5"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 14,
                      color: "var(--stage-text)",
                      border: "1px solid var(--stage-border-subtle)",
                    }}
                  >
                    Clear
                  </button>
                </div>

                {smtpStatus && (
                  <div style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 14,
                    color: smtpStatus.includes("success") || smtpStatus.includes("cleared") ? "var(--stage-success)" : "var(--stage-danger)",
                  }}>
                    {smtpStatus}
                  </div>
                )}
              </div>

              <div
                className="p-3 rounded-lg"
                style={{ background: "rgba(71,184,232,0.05)", border: "1px solid rgba(71,184,232,0.15)" }}
              >
                <p style={{ fontFamily: "DM Mono, monospace", fontSize: 13, color: "var(--stage-info)", lineHeight: 1.6 }}>
                  If no SMTP is configured here, the system will use the default server settings.
                  Per-project SMTP lets invites come from your own email address.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid var(--stage-border)" }}
        >
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 rounded transition-colors hover:bg-red-500/10"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 14,
              color: "var(--stage-danger)",
              border: "1px solid rgba(232, 120, 71, 0.3)",
            }}
          >
            Sign Out
          </button>
          <button
            onClick={closeSettings}
            className="px-4 py-2 rounded transition-colors hover:bg-white/5"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 14,
              color: "var(--stage-text)",
              border: "1px solid var(--stage-border-subtle)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Shared form components ----

function RoleEditForm({
  name, icon, color, saving,
  onNameChange, onIconChange, onColorChange,
  onSave, onCancel, saveLabel = "Save",
}: {
  name: string; icon: string; color: string; saving: boolean;
  onNameChange: (v: string) => void;
  onIconChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  saveLabel?: string;
}) {
  return (
    <div
      className="space-y-3 p-4 rounded-lg"
      style={{
        background: "var(--stage-line-hover)",
        border: "1px solid var(--stage-border)",
      }}
    >
      <div>
        <label className="block mb-1" style={labelStyle}>Role Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Wardrobe"
          className="w-full px-3 py-2 rounded"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block mb-1" style={labelStyle}>Icon</label>
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => onIconChange(ic)}
              className="w-8 h-8 rounded flex items-center justify-center transition-all"
              style={{
                fontSize: 14,
                color: icon === ic ? color : "var(--stage-dim)",
                background: icon === ic ? color + "15" : "transparent",
                border: `1px solid ${icon === ic ? color + "40" : "var(--stage-border-subtle)"}`,
              }}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block mb-1" style={labelStyle}>Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className="w-7 h-7 rounded-full transition-all"
              style={{
                background: c,
                border: color === c ? "2px solid #fff" : "2px solid transparent",
                opacity: color === c ? 1 : 0.5,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded transition-colors hover:bg-white/5"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 14,
            color: "var(--stage-text)",
            border: "1px solid var(--stage-border-subtle)",
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 rounded transition-colors"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--stage-gold)",
            background: "#E8C54715",
            border: "1px solid #E8C54740",
            opacity: saving || !name.trim() ? 0.5 : 1,
          }}
        >
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

function CueTypeEditForm({
  label, typeKey, color, role, saving,
  onLabelChange, onTypeKeyChange, onColorChange, onRoleChange,
  onSave, onCancel, saveLabel = "Save",
}: {
  label: string; typeKey: string; color: string; role: string; saving: boolean;
  onLabelChange: (v: string) => void;
  onTypeKeyChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onRoleChange: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  saveLabel?: string;
}) {
  return (
    <div
      className="space-y-3 p-4 rounded-lg"
      style={{
        background: "var(--stage-line-hover)",
        border: "1px solid var(--stage-border)",
      }}
    >
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block mb-1" style={labelStyle}>Label (short)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. SFX"
            className="w-full px-3 py-2 rounded"
            style={inputStyle}
          />
        </div>
        <div className="flex-1">
          <label className="block mb-1" style={labelStyle}>Type Key</label>
          <input
            type="text"
            value={typeKey}
            onChange={(e) => onTypeKeyChange(e.target.value)}
            placeholder="e.g. SFX"
            className="w-full px-3 py-2 rounded"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label className="block mb-1" style={labelStyle}>Associated Role</label>
        <input
          type="text"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          placeholder="e.g. SOUND or custom role name"
          className="w-full px-3 py-2 rounded"
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block mb-1" style={labelStyle}>Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className="w-7 h-7 rounded-full transition-all"
              style={{
                background: c,
                border: color === c ? "2px solid #fff" : "2px solid transparent",
                opacity: color === c ? 1 : 0.5,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded transition-colors hover:bg-white/5"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 14,
            color: "var(--stage-text)",
            border: "1px solid var(--stage-border-subtle)",
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !label.trim() || !typeKey.trim()}
          className="px-3 py-1.5 rounded transition-colors"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--stage-gold)",
            background: "#E8C54715",
            border: "1px solid #E8C54740",
            opacity: saving || !label.trim() || !typeKey.trim() ? 0.5 : 1,
          }}
        >
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

// ---- Roles Tab Content with Drag-and-Drop Ordering ----

function RolesTabContent({
  theme,
  customRoles,
  roleOrder,
  setRoleOrder,
  roleError,
  setRoleError,
  editingRoleId,
  setEditingRoleId,
  editRoleName,
  editRoleIcon,
  editRoleColor,
  setEditRoleName,
  setEditRoleIcon,
  setEditRoleColor,
  roleSaving,
  handleUpdateRole,
  handleDeleteRole,
  startEditRole,
  showAddRole,
  setShowAddRole,
  newRoleName,
  newRoleIcon,
  newRoleColor,
  setNewRoleName,
  setNewRoleIcon,
  setNewRoleColor,
  handleAddRole,
}: {
  theme: "dark" | "light";
  customRoles: CustomRoleView[];
  roleOrder: string[];
  setRoleOrder: (order: string[]) => void;
  roleError: string | null;
  setRoleError: (err: string | null) => void;
  editingRoleId: string | null;
  setEditingRoleId: (id: string | null) => void;
  editRoleName: string;
  editRoleIcon: string;
  editRoleColor: string;
  setEditRoleName: (v: string) => void;
  setEditRoleIcon: (v: string) => void;
  setEditRoleColor: (v: string) => void;
  roleSaving: boolean;
  handleUpdateRole: () => void;
  handleDeleteRole: (id: string) => void;
  startEditRole: (role: CustomRoleView) => void;
  showAddRole: boolean;
  setShowAddRole: (v: boolean) => void;
  newRoleName: string;
  newRoleIcon: string;
  newRoleColor: string;
  setNewRoleName: (v: string) => void;
  setNewRoleIcon: (v: string) => void;
  setNewRoleColor: (v: string) => void;
  handleAddRole: () => void;
}) {
  // Cue bubble settings from store
  const roleCueBubbles = useStageStore((s) => s.roleCueBubbles);
  const toggleRoleCueBubbles = useStageStore((s) => s.toggleRoleCueBubbles);

  // Light theme color overrides for built-in roles
  const lightAlt: Record<string, string> = {
    ACTOR: "#3D5A80",
    DIRECTOR: "#555555",
    LIGHTING: "#8B6B14",
    WRITER: "#6B6B1A",
    VIEWER: "#666666",
  };

  // Combine built-in roles with custom roles
  const allRoles = useMemo(() => {
    const builtIn = ROLE_LIST.map((r) => ({
      id: r.id,
      label: r.label,
      icon: r.icon,
      color: r.color,
      isBuiltIn: true,
    }));
    const custom = customRoles.map((r) => ({
      id: r.id,
      label: r.name,
      icon: r.icon,
      color: r.color,
      isBuiltIn: false,
    }));
    return [...builtIn, ...custom];
  }, [customRoles]);

  // Sort roles by roleOrder (roles not in order go to the end in their original order)
  const sortedRoles = useMemo(() => {
    if (roleOrder.length === 0) return allRoles;
    const orderMap = new Map(roleOrder.map((id, idx) => [id, idx]));
    return [...allRoles].sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? Infinity;
      const bIdx = orderMap.get(b.id) ?? Infinity;
      if (aIdx === Infinity && bIdx === Infinity) {
        return allRoles.indexOf(a) - allRoles.indexOf(b);
      }
      return aIdx - bIdx;
    });
  }, [allRoles, roleOrder]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, roleId: string) => {
    setDraggedId(roleId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", roleId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, roleId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (roleId !== draggedId) {
      setDragOverId(roleId);
    }
  }, [draggedId]);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const currentOrder = sortedRoles.map((r) => r.id);
    const draggedIdx = currentOrder.indexOf(draggedId);
    const targetIdx = currentOrder.indexOf(targetId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedId);

    setRoleOrder(newOrder);
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, sortedRoles, setRoleOrder]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleReset = useCallback(() => {
    setRoleOrder([]);
  }, [setRoleOrder]);

  // Get color for a role (with theme consideration)
  const getRoleColor = (role: { id: string; color: string; isBuiltIn: boolean }) => {
    if (role.isBuiltIn && theme === "light" && lightAlt[role.id]) {
      return lightAlt[role.id];
    }
    return role.color;
  };

  return (
    <div className="space-y-4">
      <p
        style={{
          fontFamily: "DM Mono, monospace",
          fontSize: 15,
          color: "var(--stage-text)",
        }}
      >
        Manage and reorder roles. Drag to change the order in the View As bar.
      </p>

      {roleError && (
        <div
          className="px-3 py-2 rounded text-sm"
          style={{
            background: "rgba(232, 120, 71, 0.1)",
            border: "1px solid rgba(232, 120, 71, 0.3)",
            color: "var(--stage-danger)",
            fontFamily: "DM Mono, monospace",
            fontSize: 12,
          }}
        >
          {roleError}
        </div>
      )}

      {/* All roles - draggable */}
      <div className="space-y-1.5">
        {sortedRoles.map((role) => {
          const textColor = getRoleColor(role);
          const customRole = !role.isBuiltIn ? customRoles.find((r) => r.id === role.id) : null;
          const isEditing = editingRoleId === role.id;

          if (isEditing && customRole) {
            return (
              <RoleEditForm
                key={role.id}
                name={editRoleName}
                icon={editRoleIcon}
                color={editRoleColor}
                saving={roleSaving}
                onNameChange={setEditRoleName}
                onIconChange={setEditRoleIcon}
                onColorChange={setEditRoleColor}
                onSave={handleUpdateRole}
                onCancel={() => { setEditingRoleId(null); setRoleError(null); }}
              />
            );
          }

          return (
            <div
              key={role.id}
              draggable
              onDragStart={(e) => handleDragStart(e, role.id)}
              onDragOver={(e) => handleDragOver(e, role.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, role.id)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all group"
              style={{
                background: dragOverId === role.id
                  ? "var(--stage-gold-bg)"
                  : draggedId === role.id
                  ? "var(--stage-hover)"
                  : "var(--stage-line-hover)",
                border: dragOverId === role.id
                  ? "1px solid var(--stage-gold-border)"
                  : "1px solid var(--stage-border)",
                opacity: draggedId === role.id ? 0.5 : 1,
              }}
            >
              <span
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 12,
                  color: "var(--stage-muted)",
                  cursor: "grab",
                }}
              >
                ⋮⋮
              </span>
              <span style={{ fontSize: 16, color: textColor }}>
                {role.icon}
              </span>
              <span
                className="flex-1"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 14,
                  fontWeight: 600,
                  color: textColor,
                }}
              >
                {role.label}
              </span>
              {/* Cue bubble toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleRoleCueBubbles(role.id); }}
                className="px-2 py-1 rounded transition-all"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 11,
                  color: roleCueBubbles.has(role.id) ? "var(--stage-gold)" : "var(--stage-muted)",
                  background: roleCueBubbles.has(role.id) ? "var(--stage-gold-bg)" : "transparent",
                  border: `1px solid ${roleCueBubbles.has(role.id) ? "var(--stage-gold-border)" : "var(--stage-border-subtle)"}`,
                }}
                title={roleCueBubbles.has(role.id) ? "Cue bubbles enabled" : "Cue bubbles disabled"}
              >
                {roleCueBubbles.has(role.id) ? "◉ Bubbles" : "○ Bubbles"}
              </button>
              {role.isBuiltIn ? (
                <span
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 11,
                    color: "var(--stage-muted)",
                    border: "1px solid var(--stage-border-subtle)",
                    borderRadius: 4,
                    padding: "1px 5px",
                  }}
                >
                  built-in
                </span>
              ) : (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (customRole) startEditRole(customRole); }}
                    className="px-2 py-1 rounded hover:bg-white/5"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 13,
                      color: "var(--stage-text)",
                      border: "1px solid var(--stage-border-subtle)",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                    className="px-2 py-1 rounded hover:bg-red-500/10"
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 13,
                      color: "var(--stage-error)",
                      border: "1px solid #E8474740",
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reset order button */}
      {roleOrder.length > 0 && (
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded transition-colors hover:bg-white/5"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: 13,
            color: "var(--stage-muted)",
            border: "1px solid var(--stage-border-subtle)",
          }}
        >
          Reset to Default Order
        </button>
      )}

      {/* Add role form */}
      <div className="pt-2">
        {showAddRole ? (
          <RoleEditForm
            name={newRoleName}
            icon={newRoleIcon}
            color={newRoleColor}
            saving={roleSaving}
            onNameChange={setNewRoleName}
            onIconChange={setNewRoleIcon}
            onColorChange={setNewRoleColor}
            onSave={handleAddRole}
            onCancel={() => { setShowAddRole(false); setRoleError(null); }}
            saveLabel="Add Role"
          />
        ) : (
          <button
            onClick={() => setShowAddRole(true)}
            className="w-full px-4 py-2.5 rounded-lg transition-colors hover:bg-white/3"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 14,
              color: "var(--stage-text)",
              border: "1px dashed var(--stage-border-subtle)",
            }}
          >
            + Add Custom Role
          </button>
        )}
      </div>
    </div>
  );
}
