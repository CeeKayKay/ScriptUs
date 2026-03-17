"use client";

import { useState, useEffect, useCallback } from "react";
import { useStageStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTheme } from "@/hooks/useTheme";
import type { CharacterGroupView, CharacterView, LocationView } from "@/types";

type Tab = "characters" | "locations";

export function WriterSidePanel() {
  const {
    projectId,
    toggleCuePanel,
    cuePanelSide,
    scriptTextSize,
    characterGroups,
    ungroupedCharacters,
    locations,
    setCharacterGroups,
    setUngroupedCharacters,
    setLocations,
    setPendingDialogue,
  } = useStageStore();

  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>("characters");
  const [loaded, setLoaded] = useState(false);

  // Character state
  const [newCharName, setNewCharName] = useState("");
  const [newCharGroupId, setNewCharGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  // Location state
  const [newLocName, setNewLocName] = useState("");

  const [saving, setSaving] = useState(false);

  const writerColor = theme === "light" ? "#8B8B1A" : "#E8E847";

  // Load data
  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [charRes, locRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/characters`),
        fetch(`/api/projects/${projectId}/locations`),
      ]);
      if (charRes.ok) {
        const data = await charRes.json();
        setCharacterGroups(data.groups);
        setUngroupedCharacters(data.ungrouped);
      }
      if (locRes.ok) {
        const data = await locRes.json();
        setLocations(data);
      }
    } catch {}
    setLoaded(true);
  }, [projectId, setCharacterGroups, setUngroupedCharacters, setLocations]);

  useEffect(() => {
    if (!loaded) loadData();
  }, [loaded, loadData]);

  // Add character
  const handleAddCharacter = async () => {
    if (!newCharName.trim() || !projectId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCharName.trim(), groupId: newCharGroupId }),
      });
      if (res.ok) {
        setNewCharName("");
        await loadData();
      } else {
        const text = await res.text();
        try { const data = JSON.parse(text); alert(data.error || "Failed to add character"); } catch { alert(`Server error (${res.status}): ${text.slice(0, 200) || "No response"}`); }
      }
    } catch (e: any) { console.error("Add character error:", e); alert(e.message || "Network error"); } finally { setSaving(false); }
  };

  // Add group
  const handleAddGroup = async () => {
    if (!newGroupName.trim() || !projectId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group", name: newGroupName.trim() }),
      });
      if (res.ok) {
        setNewGroupName("");
        setShowAddGroup(false);
        await loadData();
      } else {
        const text = await res.text();
        try { const data = JSON.parse(text); alert(data.error || "Failed to add group"); } catch { alert(`Server error (${res.status}): ${text.slice(0, 200) || "No response"}`); }
      }
    } catch (e: any) { console.error("Add group error:", e); alert(e.message || "Network error"); } finally { setSaving(false); }
  };

  // Rename group
  const handleRenameGroup = async (groupId: string) => {
    if (!editGroupName.trim() || !projectId) return;
    try {
      await fetch(`/api/projects/${projectId}/characters`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, name: editGroupName.trim() }),
      });
      setEditingGroupId(null);
      await loadData();
    } catch {}
  };

  // Delete character
  const handleDeleteChar = async (charId: string) => {
    if (!projectId) return;
    try {
      await fetch(`/api/projects/${projectId}/characters?characterId=${charId}`, { method: "DELETE" });
      await loadData();
    } catch {}
  };

  // Delete group
  const handleDeleteGroup = async (groupId: string) => {
    if (!projectId || !confirm("Delete this group? Characters will be ungrouped.")) return;
    try {
      await fetch(`/api/projects/${projectId}/characters?groupId=${groupId}`, { method: "DELETE" });
      await loadData();
    } catch {}
  };

  // Move character to group
  const handleMoveChar = async (charId: string, groupId: string | null) => {
    if (!projectId) return;
    try {
      await fetch(`/api/projects/${projectId}/characters`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: charId, groupId }),
      });
      await loadData();
    } catch {}
  };

  // Add location
  const handleAddLocation = async () => {
    if (!newLocName.trim() || !projectId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocName.trim() }),
      });
      if (res.ok) {
        setNewLocName("");
        await loadData();
      } else {
        const text = await res.text();
        try { const data = JSON.parse(text); alert(data.error || "Failed to add location"); } catch { alert(`Server error (${res.status}): ${text.slice(0, 200) || "No response"}`); }
      }
    } catch (e: any) { console.error("Add location error:", e); alert(e.message || "Network error"); } finally { setSaving(false); }
  };

  // Delete location
  const handleDeleteLocation = async (id: string) => {
    if (!projectId) return;
    try {
      await fetch(`/api/projects/${projectId}/locations?id=${id}`, { method: "DELETE" });
      await loadData();
    } catch {}
  };

  const fs = (ratio: number) => Math.round(scriptTextSize * ratio);

  const renderCharacter = (char: CharacterView) => (
    <div
      key={char.id}
      className="group/char flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5 transition-colors"
    >
      <span
        onClick={() => setPendingDialogue({ character: char.name })}
        title={`Click to add ${char.name} dialogue`}
        style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.8), fontWeight: 600, color: "var(--stage-heading)", letterSpacing: "0.03em", cursor: "pointer" }}
        className="hover:underline"
      >
        {char.name}
      </span>
      <div className="flex gap-1 opacity-0 group-hover/char:opacity-100 transition-opacity">
        {/* Move to group dropdown */}
        <select
          value={char.groupId || ""}
          onChange={(e) => handleMoveChar(char.id, e.target.value || null)}
          className="rounded"
          style={{
            fontFamily: "DM Mono, monospace",
            fontSize: fs(0.75),
            background: "var(--stage-bg)",
            border: "1px solid var(--stage-border)",
            color: "var(--stage-muted)",
            padding: "1px 4px",
          }}
          title="Move to group"
        >
          <option value="">Ungrouped</option>
          {characterGroups.map((g: CharacterGroupView) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button
          onClick={() => handleDeleteChar(char.id)}
          className="px-1 rounded hover:bg-red-500/10"
          style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), color: "var(--stage-error)" }}
        >
          ✕
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="flex flex-col animate-slide-in"
      style={{
        ...(isMobile
          ? { position: "fixed", inset: 0, zIndex: 40, width: "100%", background: "var(--stage-surface)" }
          : {
              flexShrink: 0,
              width: 320,
              background: "var(--stage-surface)",
              ...(cuePanelSide === "left"
                ? { borderRight: `1px solid ${writerColor}15` }
                : { borderLeft: `1px solid ${writerColor}15` }),
            }),
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3.5 py-3 flex-shrink-0"
        style={{ background: "var(--stage-viewas-bg)", borderBottom: `1px solid ${writerColor}15` }}
      >
        <div style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), fontWeight: 700, color: writerColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          ✎ Writer Sheet
        </div>
        <button
          onClick={toggleCuePanel}
          className="text-xs px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
          style={{ fontFamily: "DM Mono, monospace", color: "var(--stage-faint)" }}
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${writerColor}10` }}>
        {(["characters", "locations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-md transition-all"
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: fs(0.75),
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? writerColor : "var(--stage-muted)",
              background: tab === t ? `${writerColor}12` : "transparent",
              border: tab === t ? `1px solid ${writerColor}40` : "1px solid transparent",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === "characters" && (
          <div className="space-y-4">
            {/* Add character form */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="Character name"
                  className="flex-1 px-2 py-1.5 rounded"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: fs(0.75),
                    background: "var(--stage-bg)",
                    border: "1px solid var(--stage-border)",
                    color: "var(--stage-text)",
                    outline: "none",
                    minWidth: 0,
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCharacter(); }}
                />
                <button
                  onClick={handleAddCharacter}
                  disabled={saving || !newCharName.trim()}
                  className="px-3 py-1.5 rounded transition-colors flex-shrink-0"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: fs(0.7),
                    fontWeight: 600,
                    color: writerColor,
                    background: `${writerColor}15`,
                    border: `1px solid ${writerColor}40`,
                    opacity: saving || !newCharName.trim() ? 0.5 : 1,
                  }}
                >
                  Add
                </button>
              </div>
              <select
                value={newCharGroupId || ""}
                onChange={(e) => setNewCharGroupId(e.target.value || null)}
                className="w-full rounded px-2 py-1.5"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: fs(0.7),
                  background: "var(--stage-bg)",
                  border: "1px solid var(--stage-border)",
                  color: "var(--stage-muted)",
                }}
              >
                <option value="">No group</option>
                {characterGroups.map((g: CharacterGroupView) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Add group */}
            {showAddGroup ? (
              <div className="flex gap-2">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name"
                  className="flex-1 px-2 py-1.5 rounded"
                  style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: fs(0.75),
                    background: "var(--stage-bg)",
                    border: "1px solid var(--stage-border)",
                    color: "var(--stage-text)",
                    outline: "none",
                    minWidth: 0,
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddGroup(); }}
                  autoFocus
                />
                <button
                  onClick={handleAddGroup}
                  disabled={saving || !newGroupName.trim()}
                  className="px-2 py-1 rounded flex-shrink-0"
                  style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.7), color: writerColor, border: `1px solid ${writerColor}40` }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddGroup(false); setNewGroupName(""); }}
                  className="px-2 py-1 rounded flex-shrink-0"
                  style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.7), color: "var(--stage-muted)", border: "1px solid var(--stage-border)" }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddGroup(true)}
                className="w-full py-1.5 rounded transition-colors hover:bg-white/3"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: fs(0.7),
                  color: "var(--stage-dim)",
                  border: "1px dashed var(--stage-border-subtle)",
                }}
              >
                + Add Group
              </button>
            )}

            {/* Groups */}
            {characterGroups.map((group: CharacterGroupView) => (
              <div key={group.id}>
                <div className="flex items-center justify-between mb-1 group/grp">
                  {editingGroupId === group.id ? (
                    <input
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      onBlur={() => handleRenameGroup(group.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRenameGroup(group.id); if (e.key === "Escape") setEditingGroupId(null); }}
                      className="flex-1 px-2 py-0.5 rounded"
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: fs(0.7),
                        background: "var(--stage-bg)",
                        border: "1px solid var(--stage-border)",
                        color: "var(--stage-text)",
                        outline: "none",
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name); }}
                      style={{
                        fontFamily: "DM Mono, monospace",
                        fontSize: fs(0.8),
                        fontWeight: 600,
                        color: "var(--stage-gold)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        cursor: "text",
                      }}
                    >
                      {group.name}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="opacity-0 group-hover/grp:opacity-100 transition-opacity px-1 rounded hover:bg-red-500/10"
                    style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), color: "var(--stage-error)" }}
                  >
                    ✕
                  </button>
                </div>
                <div className="ml-2 border-l-2 pl-2" style={{ borderColor: `${writerColor}25` }}>
                  {group.characters.length === 0 && (
                    <div style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.8), color: "var(--stage-faint)", padding: "4px 0" }}>
                      No characters
                    </div>
                  )}
                  {group.characters.map(renderCharacter)}
                </div>
              </div>
            ))}

            {/* Ungrouped characters */}
            {ungroupedCharacters.length > 0 && (
              <div>
                {characterGroups.length > 0 && (
                  <div style={{
                    fontFamily: "DM Mono, monospace",
                    fontSize: fs(0.7),
                    fontWeight: 600,
                    color: "var(--stage-faint)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}>
                    Ungrouped
                  </div>
                )}
                {ungroupedCharacters.map(renderCharacter)}
              </div>
            )}

            {characterGroups.length === 0 && ungroupedCharacters.length === 0 && loaded && (
              <div className="text-center py-8">
                <p style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), color: "var(--stage-text)" }}>
                  No characters yet
                </p>
                <p style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.8), color: "var(--stage-dim)", marginTop: 4 }}>
                  Add characters above to build your cast
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "locations" && (
          <div className="space-y-3">
            {/* Add location form */}
            <div className="flex gap-2">
              <input
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                placeholder="Location name"
                className="flex-1 px-2 py-1.5 rounded"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: fs(0.75),
                  background: "var(--stage-bg)",
                  border: "1px solid var(--stage-border)",
                  color: "var(--stage-text)",
                  outline: "none",
                  minWidth: 0,
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddLocation(); }}
              />
              <button
                onClick={handleAddLocation}
                disabled={saving || !newLocName.trim()}
                className="px-3 py-1.5 rounded transition-colors flex-shrink-0"
                style={{
                  fontFamily: "DM Mono, monospace",
                  fontSize: fs(0.7),
                  fontWeight: 600,
                  color: writerColor,
                  background: `${writerColor}15`,
                  border: `1px solid ${writerColor}40`,
                  opacity: saving || !newLocName.trim() ? 0.5 : 1,
                }}
              >
                Add
              </button>
            </div>

            {/* Location list */}
            {locations.map((loc: LocationView) => (
              <div
                key={loc.id}
                className="group/loc flex items-center justify-between py-2 px-2 rounded hover:bg-white/5 transition-colors"
              >
                <span style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), color: "var(--stage-text)" }}>
                  {loc.name}
                </span>
                <button
                  onClick={() => handleDeleteLocation(loc.id)}
                  className="opacity-0 group-hover/loc:opacity-100 transition-opacity px-1 rounded hover:bg-red-500/10"
                  style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), color: "var(--stage-error)" }}
                >
                  ✕
                </button>
              </div>
            ))}

            {locations.length === 0 && loaded && (
              <div className="text-center py-8">
                <p style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.75), color: "var(--stage-text)" }}>
                  No locations yet
                </p>
                <p style={{ fontFamily: "DM Mono, monospace", fontSize: fs(0.8), color: "var(--stage-dim)", marginTop: 4 }}>
                  Add locations for your scenes
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
