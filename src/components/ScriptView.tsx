"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { useStageStore } from "@/lib/store";
import { ROLES } from "@/lib/roles";
import { ScriptLine } from "./ScriptLine";
import type { CueView, ScriptLineView } from "@/types";

export function ScriptView() {
  const {
    activeRole,
    scenes,
    activeCueId,
    setActiveCueId,
    setVisibleLineIds,
    openCueEditor,
  } = useStageStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const visibleLineIdsRef = useRef<Set<string>>(new Set());
  const roleConfig = ROLES[activeRole];

  // Flatten all lines across scenes, with scene headers injected
  const allLines = useMemo(() => {
    const lines: ScriptLineView[] = [];

    scenes.forEach((scene, si) => {
      // Inject act header if first scene of an act
      if (si === 0 || scene.act !== scenes[si - 1].act) {
        lines.push({
          id: `act-${scene.act}`,
          sceneId: scene.id,
          type: "ACT_HEADER",
          text: `ACT ${scene.act === 1 ? "ONE" : scene.act === 2 ? "TWO" : scene.act === 3 ? "THREE" : String(scene.act)}`,
          sortOrder: -2,
          cues: [],
        });
      }

      // Scene header
      lines.push({
        id: `scene-header-${scene.id}`,
        sceneId: scene.id,
        type: "SCENE_HEADER",
        text: `Scene ${scene.scene} — ${scene.title}`,
        sortOrder: -1,
        cues: [],
      });

      // Script lines
      lines.push(...scene.lines);
    });

    return lines;
  }, [scenes]);

  // Intersection observer to track visible lines
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const next = new Set(visibleLineIdsRef.current);
          entries.forEach((entry) => {
            const lineId = entry.target.getAttribute("data-line-id");
            if (lineId) {
              if (entry.isIntersecting) {
                next.add(lineId);
              } else {
                next.delete(lineId);
              }
            }
          });
          visibleLineIdsRef.current = next;
          setVisibleLineIds(next);
      },
      { root: container, threshold: 0.1 }
    );

    // Observe all line elements
    Object.values(lineRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [allLines, setVisibleLineIds]);

  const handleCueClick = useCallback(
    (cue: CueView) => {
      setActiveCueId(cue.id === activeCueId ? null : cue.id);
    },
    [activeCueId, setActiveCueId]
  );

  const handleAddCue = useCallback(
    (lineId: string) => {
      // Open cue editor in creation mode
      openCueEditor();
    },
    [openCueEditor]
  );

  // Can user add cues in this role?
  const canAddCues = [
    "STAGE_MANAGER",
    "LIGHTING",
    "SOUND",
    "SET_DESIGN",
    "PROPS",
    "DIRECTOR",
  ].includes(activeRole);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      style={{ padding: "20px 32px 80px" }}
    >
      <div style={{ maxWidth: 740, margin: "0 auto" }}>
        {allLines.map((line) => (
          <ScriptLine
            key={line.id}
            ref={(el) => {
              lineRefs.current[line.id] = el;
            }}
            line={line}
            visibleCueTypes={roleConfig.visibleCueTypes}
            activeCueId={activeCueId}
            onCueClick={handleCueClick}
            onAddCue={handleAddCue}
            showAddButton={canAddCues}
          />
        ))}

        {allLines.length === 0 && (
          <div className="text-center py-20">
            <p
              style={{
                fontFamily: "Playfair Display, serif",
                fontSize: 20,
                color: "#555",
              }}
            >
              No script content yet
            </p>
            <p
              style={{
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
                color: "#444",
                marginTop: 8,
              }}
            >
              Add scenes and lines to begin
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Export scroll-to-line helper for use by the cue panel
export function scrollToLine(
  lineId: string,
  lineRefs: Record<string, HTMLDivElement | null>
) {
  const el = lineRefs[lineId];
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
