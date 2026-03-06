"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useStageStore } from "@/lib/store";
import { ROLE_LIST } from "@/lib/roles";
import { CUE_TYPE_LIST } from "@/lib/cue-types";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  fontSize: 13,
  background: "#13120f",
  border: "1px solid #2a2720",
  color: "#e0ddd5",
  outline: "none",
} as const;

const labelStyle = {
  fontFamily: "DM Mono, monospace",
  fontSize: 10,
  color: "#888",
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
  } = useStageStore();

  const isAdmin = myRoles.some((r) => ADMIN_ROLES.includes(r));
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
    if (activeTab !== "email" || !isAdmin || smtpLoaded) return;
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

  // Local member state for optimistic UI updates
  const [localMembers, setLocalMembers] = useState(members);
  useEffect(() => { setLocalMembers(members); }, [members]);

  const handleUpdateMemberRoles = (memberId: string, roles: ProjectRole[]) => {
    if (roles.length === 0) return;
    // Optimistic update
    setLocalMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, roles } : m))
    );
    // Fire and forget API call
    fetch(`/api/projects/${projectId}/invites`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, roles }),
    }).catch(() => {});
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from this production? They will lose access.`)) return;
    try {
      await fetch(`/api/projects/${projectId}/invites`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, action: "remove" }),
      });
      window.location.reload();
    } catch {}
  };

  const tabs: { id: SettingsTab; label: string; adminOnly: boolean }[] = [
    { id: "preferences", label: "Preferences", adminOnly: false },
    { id: "team", label: "Team", adminOnly: true },
    { id: "roles", label: "Roles", adminOnly: true },
    { id: "cue-types", label: "Cue Types", adminOnly: true },
    { id: "email", label: "Email", adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full animate-fade-in"
        style={{
          background: "#1a1916",
          border: isMobile ? "none" : "1px solid #2a2720",
          boxShadow: isMobile ? "none" : "0 25px 50px rgba(0,0,0,0.5)",
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
          style={{ borderBottom: "1px solid #2a2720" }}
        >
          <h2
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: 18,
              fontWeight: 600,
              color: "#e0ddd5",
            }}
          >
            Settings
          </h2>
          <button
            onClick={closeSettings}
            className="text-sm px-2 py-1 rounded hover:bg-white/5"
            style={{ fontFamily: "DM Mono, monospace", color: "#888" }}
          >
            X
          </button>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-1 px-6 py-2 flex-shrink-0"
          style={{ borderBottom: "1px solid #2a2720" }}
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-1.5 rounded-md transition-all"
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 11,
                fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? "#E8C547" : "#777",
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
              <div>
                <label className="block mb-2" style={labelStyle}>
                  Cue Panel Position
                </label>
                <p
                  className="mb-3"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 11,
                    color: "#666",
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
                        fontSize: 12,
                        fontWeight: cuePanelSide === side ? 700 : 400,
                        color: cuePanelSide === side ? "#E8C547" : "#666",
                        background:
                          cuePanelSide === side
                            ? "#E8C54712"
                            : "rgba(255,255,255,0.02)",
                        border: `1px solid ${
                          cuePanelSide === side ? "#E8C54740" : "#333"
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
                    fontSize: 11,
                    color: "#666",
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
                    style={{ accentColor: "#E8C547" }}
                  />
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#E8C547",
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
                        fontSize: 11,
                        fontWeight: scriptTextSize === size ? 700 : 400,
                        color: scriptTextSize === size ? "#E8C547" : "#666",
                        background:
                          scriptTextSize === size
                            ? "#E8C54712"
                            : "rgba(255,255,255,0.02)",
                        border: `1px solid ${
                          scriptTextSize === size ? "#E8C54740" : "#333"
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
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid #2a2720",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "DM Mono, monospace",
                      fontSize: 9,
                      color: "#555",
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
          {activeTab === "team" && isAdmin && (
            <div className="space-y-4">
              <p style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#666" }}>
                Manage team members and send invitations.
              </p>

              {/* Invite form */}
              <div
                className="p-4 rounded-lg space-y-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #2a2720" }}
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
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#E8C547",
                    background: "#E8C54715",
                    border: "1px solid #E8C54740",
                    opacity: inviteSending || !inviteEmail.trim() ? 0.5 : 1,
                  }}
                >
                  {inviteSending ? "Sending..." : "Send Invite"}
                </button>
                {inviteError && (
                  <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#E87847" }}>
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#47E86A" }}>
                    {inviteSuccess}
                  </div>
                )}
              </div>

              {/* Current members */}
              <div>
                <div className="mb-2" style={labelStyle}>Members</div>
                <div className="space-y-1.5">
                  {localMembers.map((m) => (
                    <div
                      key={m.id}
                      className="px-3 py-2.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #222" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{
                            background: "rgba(232,197,71,0.1)",
                            border: "1px solid #E8C54740",
                            color: "#E8C547",
                            fontFamily: "DM Mono, monospace",
                          }}
                        >
                          {(m.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#e0ddd5", fontWeight: 600 }}>
                            {m.name}
                          </div>
                          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#666" }}>
                            {m.email}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(m.id, m.name)}
                          className="px-2 py-1 rounded text-[10px] hover:bg-red-500/10 transition-colors flex-shrink-0"
                          style={{ fontFamily: "DM Mono, monospace", color: "#E84747", border: "1px solid #E8474730" }}
                        >
                          Remove
                        </button>
                      </div>
                      {/* Multi-role checkboxes */}
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-10">
                        {ROLE_LIST.map((r) => {
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
                              className="px-2 py-0.5 rounded transition-all"
                              style={{
                                fontFamily: "DM Mono, monospace",
                                fontSize: 9,
                                color: hasRole ? r.color : "#555",
                                background: hasRole ? r.color + "15" : "transparent",
                                border: `1px solid ${hasRole ? r.color + "40" : "#333"}`,
                              }}
                            >
                              {r.icon} {r.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending invites */}
              {invites.filter((i) => i.status === "PENDING").length > 0 && (
                <div>
                  <div className="mb-2" style={labelStyle}>Pending Invites</div>
                  <div className="space-y-1.5">
                    {invites.filter((i) => i.status === "PENDING").map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed #2a2720" }}
                      >
                        <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: "#888", flex: 1 }}>
                          {inv.email}
                        </div>
                        <span style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#E8C547" }}>
                          {inv.role.replace(/_/g, " ")}
                        </span>
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded text-[10px] hover:bg-red-500/10"
                          style={{ fontFamily: "DM Mono, monospace", color: "#E84747", border: "1px solid #E8474740" }}
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
            <div className="space-y-4">
              <p
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 11,
                  color: "#666",
                }}
              >
                Manage roles for this project.
              </p>

              {/* Built-in roles */}
              <div>
                <div
                  className="mb-2"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 10,
                    color: "#888",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Built-in Roles
                </div>
                <div className="space-y-1.5">
                  {ROLE_LIST.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid #222",
                      }}
                    >
                      <span style={{ fontSize: 16, color: role.color }}>
                        {role.icon}
                      </span>
                      <span
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: 12,
                          fontWeight: 600,
                          color: role.color,
                        }}
                      >
                        {role.label}
                      </span>
                      <span
                        className="ml-auto"
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: 9,
                          color: "#555",
                          border: "1px solid #333",
                          borderRadius: 4,
                          padding: "1px 5px",
                        }}
                      >
                        built-in
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom roles section */}
              <div>
                <div
                  className="mb-2"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 10,
                    color: "#888",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Custom Roles
                </div>

              {roleError && (
                <div
                  className="px-3 py-2 rounded text-sm"
                  style={{
                    background: "rgba(232, 120, 71, 0.1)",
                    border: "1px solid rgba(232, 120, 71, 0.3)",
                    color: "#E87847",
                    fontFamily: "DM Mono, monospace",
                    fontSize: 12,
                  }}
                >
                  {roleError}
                </div>
              )}

              {/* Existing custom roles */}
              {customRoles.length > 0 && (
                <div className="space-y-2">
                  {customRoles.map((role) =>
                    editingRoleId === role.id ? (
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
                    ) : (
                      <div
                        key={role.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid #2a2720",
                        }}
                      >
                        <span style={{ fontSize: 16, color: role.color }}>
                          {role.icon}
                        </span>
                        <span
                          className="flex-1"
                          style={{
                            fontFamily: "DM Mono, monospace",
                            fontSize: 12,
                            fontWeight: 600,
                            color: role.color,
                          }}
                        >
                          {role.name}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditRole(role)}
                            className="px-2 py-1 rounded text-[10px] hover:bg-white/5"
                            style={{
                              fontFamily: "DM Mono, monospace",
                              color: "#888",
                              border: "1px solid #333",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role.id)}
                            className="px-2 py-1 rounded text-[10px] hover:bg-red-500/10"
                            style={{
                              fontFamily: "DM Mono, monospace",
                              color: "#E84747",
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

              {customRoles.length === 0 && !showAddRole && (
                <div
                  className="text-center py-6"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 11,
                    color: "#555",
                  }}
                >
                  No custom roles yet
                </div>
              )}

              {/* Add role form */}
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
                    fontSize: 11,
                    color: "#888",
                    border: "1px dashed #333",
                  }}
                >
                  + Add Custom Role
                </button>
              )}
              </div>
            </div>
          )}

          {/* ===== CUE TYPES TAB ===== */}
          {activeTab === "cue-types" && isAdmin && (
            <div className="space-y-4">
              <p
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: 11,
                  color: "#666",
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
                    fontSize: 10,
                    color: "#888",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Built-in Cue Types
                </div>
                <div className="space-y-1.5">
                  {CUE_TYPE_LIST.map((ct) => (
                    <div
                      key={ct.type}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
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
                          fontSize: 12,
                          fontWeight: 700,
                          color: ct.color,
                        }}
                      >
                        {ct.label}
                      </span>
                      <span
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: 10,
                          color: "#666",
                        }}
                      >
                        ({ct.type})
                      </span>
                      <span
                        className="ml-auto"
                        style={{
                          fontFamily: "DM Mono, monospace",
                          fontSize: 9,
                          color: "#555",
                          border: "1px solid #333",
                          borderRadius: 4,
                          padding: "1px 5px",
                        }}
                      >
                        built-in
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom cue types section */}
              <div>
                <div
                  className="mb-2"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 10,
                    color: "#888",
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
                    color: "#E87847",
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
                            fontSize: 12,
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
                            fontSize: 10,
                            color: "#666",
                          }}
                        >
                          ({ct.type})
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditCueType(ct)}
                            className="px-2 py-1 rounded text-[10px] hover:bg-white/5"
                            style={{
                              fontFamily: "DM Mono, monospace",
                              color: "#888",
                              border: "1px solid #333",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCueType(ct.id)}
                            className="px-2 py-1 rounded text-[10px] hover:bg-red-500/10"
                            style={{
                              fontFamily: "DM Mono, monospace",
                              color: "#E84747",
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
                    fontSize: 11,
                    color: "#555",
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
                    fontSize: 11,
                    color: "#888",
                    border: "1px dashed #333",
                  }}
                >
                  + Add Custom Cue Type
                </button>
              )}
              </div>
            </div>
          )}

          {/* ===== EMAIL TAB ===== */}
          {activeTab === "email" && isAdmin && (
            <div className="space-y-4">
              <p style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#666" }}>
                Configure Gmail SMTP to send invite emails from your own address.
              </p>

              <div
                className="p-4 rounded-lg space-y-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #2a2720" }}
              >
                <div style={labelStyle}>Gmail SMTP Setup</div>

                <p style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#555", lineHeight: 1.5 }}>
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
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#E8C547",
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
                      fontSize: 11,
                      color: "#888",
                      border: "1px solid #333",
                    }}
                  >
                    Clear
                  </button>
                </div>

                {smtpStatus && (
                  <div style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: 11,
                    color: smtpStatus.includes("success") || smtpStatus.includes("cleared") ? "#47E86A" : "#E87847",
                  }}>
                    {smtpStatus}
                  </div>
                )}
              </div>

              <div
                className="p-3 rounded-lg"
                style={{ background: "rgba(71,184,232,0.05)", border: "1px solid rgba(71,184,232,0.15)" }}
              >
                <p style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#47B8E8", lineHeight: 1.6 }}>
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
          style={{ borderTop: "1px solid #2a2720" }}
        >
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 rounded transition-colors hover:bg-red-500/10"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 12,
              color: "#E87847",
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
              fontSize: 12,
              color: "#888",
              border: "1px solid #333",
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
        background: "rgba(255,255,255,0.02)",
        border: "1px solid #2a2720",
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
                color: icon === ic ? color : "#666",
                background: icon === ic ? color + "15" : "transparent",
                border: `1px solid ${icon === ic ? color + "40" : "#333"}`,
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
            fontSize: 11,
            color: "#888",
            border: "1px solid #333",
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
            fontSize: 11,
            fontWeight: 600,
            color: "#E8C547",
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
        background: "rgba(255,255,255,0.02)",
        border: "1px solid #2a2720",
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
            fontSize: 11,
            color: "#888",
            border: "1px solid #333",
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
            fontSize: 11,
            fontWeight: 600,
            color: "#E8C547",
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
