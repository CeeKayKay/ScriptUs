"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { useStageStore } from "@/lib/store";
import type { CueView, ScriptLineView, SceneView } from "@/types";

// Message types for real-time sync
type SyncMessage =
  | { type: "line-update"; sceneId: string; lineId: string; updates: Partial<ScriptLineView>; senderId: string }
  | { type: "line-add"; sceneId: string; line: ScriptLineView; senderId: string }
  | { type: "line-delete"; sceneId: string; lineId: string; senderId: string }
  | { type: "scene-add"; scene: SceneView; senderId: string }
  | { type: "scene-title"; sceneId: string; title: string; senderId: string }
  | { type: "scene-delete"; sceneId: string; senderId: string }
  | { type: "cue-add"; sceneId: string; lineId: string; cue: CueView; senderId: string }
  | { type: "cue-update"; cueId: string; updates: Partial<CueView>; senderId: string }
  | { type: "cue-delete"; sceneId: string; lineId: string; cueId: string; senderId: string };

export function useRealtimeSync(doc: Y.Doc | null, userId: string) {
  const store = useStageStore;
  const broadcastRef = useRef<Y.Map<string> | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Get or create the broadcast channel
  useEffect(() => {
    if (!doc) return;

    const broadcastMap = doc.getMap<string>("broadcast");
    broadcastRef.current = broadcastMap;

    // Listen for changes from other clients
    const observer = (event: Y.YMapEvent<string>) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === "add" || change.action === "update") {
          const raw = broadcastMap.get(key);
          if (!raw) return;

          try {
            const msg: SyncMessage = JSON.parse(raw);

            // Ignore our own messages
            if (msg.senderId === userIdRef.current) return;

            const s = store.getState();

            switch (msg.type) {
              case "line-update":
                s.updateLine(msg.sceneId, msg.lineId, msg.updates);
                break;
              case "line-add":
                s.addLineToScene(msg.sceneId, msg.line);
                break;
              case "line-delete":
                s.deleteLine(msg.sceneId, msg.lineId);
                break;
              case "scene-add":
                s.addScene(msg.scene);
                break;
              case "scene-title":
                s.updateSceneTitle(msg.sceneId, msg.title);
                break;
              case "scene-delete":
                s.deleteScene(msg.sceneId);
                break;
              case "cue-add":
                s.addCueToLine(msg.sceneId, msg.lineId, msg.cue);
                break;
              case "cue-update":
                s.updateCueInStore(msg.cueId, msg.updates);
                break;
              case "cue-delete":
                s.removeCueFromLine(msg.sceneId, msg.lineId, msg.cueId);
                break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });
    };

    broadcastMap.observe(observer);

    return () => {
      broadcastMap.unobserve(observer);
    };
  }, [doc, store]);

  // Broadcast a message to all connected clients
  const broadcast = useCallback(
    (msg: Omit<SyncMessage, "senderId">) => {
      if (!broadcastRef.current || !doc) return;

      const fullMsg = { ...msg, senderId: userIdRef.current };
      const key = `${msg.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      doc.transact(() => {
        broadcastRef.current!.set(key, JSON.stringify(fullMsg));
      });

      // Clean up old messages to prevent map from growing indefinitely
      // Keep only last 50 messages
      const allKeys = Array.from(broadcastRef.current.keys());
      if (allKeys.length > 100) {
        doc.transact(() => {
          const toDelete = allKeys.slice(0, allKeys.length - 50);
          toDelete.forEach((k) => broadcastRef.current!.delete(k));
        });
      }
    },
    [doc]
  );

  return { broadcast };
}
