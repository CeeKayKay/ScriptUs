"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import type { ProjectRole } from "@/types";

const PRESENCE_COLORS = [
  "#E87847",
  "#47B8E8",
  "#C847E8",
  "#7BE847",
  "#E8C547",
  "#47E8D4",
  "#E84787",
  "#8747E8",
];

interface UseYjsOptions {
  projectId: string;
  userId: string;
  userName: string;
  userRole: ProjectRole;
}

export interface RemoteCursor {
  userId: string;
  name: string;
  color: string;
  lineId: string;
  field: "text" | "character" | "title" | null;
}

interface YjsState {
  doc: Y.Doc | null;
  provider: WebsocketProvider | null;
  awareness: Awareness | null;
  connected: boolean;
  synced: boolean;
  onlineUsers: Array<{
    userId: string;
    name: string;
    color: string;
    role: ProjectRole;
    clientId: number;
  }>;
  remoteCursors: RemoteCursor[];
}

export function useYjs({ projectId, userId, userName, userRole }: UseYjsOptions) {
  const [state, setState] = useState<YjsState>({
    doc: null,
    provider: null,
    awareness: null,
    connected: false,
    synced: false,
    onlineUsers: [],
    remoteCursors: [],
  });

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234";
    const roomName = `project-${projectId}`;

    // Create Yjs document
    const doc = new Y.Doc();
    docRef.current = doc;

    // Connect to WebSocket server
    const provider = new WebsocketProvider(wsUrl, roomName, doc, {
      connect: true,
      maxBackoffTime: 10000,
    });
    providerRef.current = provider;

    // Set local awareness state (presence)
    const colorIndex =
      userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
      PRESENCE_COLORS.length;

    provider.awareness.setLocalState({
      userId,
      name: userName,
      role: userRole,
      color: PRESENCE_COLORS[colorIndex],
      cursor: null,
    });

    // Track connection state
    provider.on("status", ({ status }: { status: string }) => {
      setState((prev) => ({
        ...prev,
        connected: status === "connected",
      }));
    });

    provider.on("sync", (synced: boolean) => {
      setState((prev) => ({ ...prev, synced }));
    });

    // Track online users and remote cursors via awareness
    const updateUsers = () => {
      const states = provider.awareness.getStates();
      const users: YjsState["onlineUsers"] = [];
      const cursors: RemoteCursor[] = [];

      states.forEach((state, clientId) => {
        if (state.userId) {
          users.push({
            userId: state.userId,
            name: state.name || "Anonymous",
            color: state.color || "#888",
            role: state.role || "VIEWER",
            clientId,
          });
          // Collect remote cursors (skip self)
          if (state.userId !== userId && state.cursor?.lineId) {
            cursors.push({
              userId: state.userId,
              name: state.name || "Anonymous",
              color: state.color || "#888",
              lineId: state.cursor.lineId,
              field: state.cursor.field || null,
            });
          }
        }
      });

      setState((prev) => ({ ...prev, onlineUsers: users, remoteCursors: cursors }));
    };

    provider.awareness.on("change", updateUsers);

    setState({
      doc,
      provider,
      awareness: provider.awareness,
      connected: false,
      synced: false,
      onlineUsers: [],
      remoteCursors: [],
    });

    return () => {
      provider.awareness.off("change", updateUsers);
      provider.disconnect();
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
    };
  }, [projectId, userId, userName, userRole]);

  // Helper: get or create a shared Y.Map for cues
  const getCuesMap = useCallback(() => {
    return docRef.current?.getMap("cues") || null;
  }, []);

  // Helper: get or create shared Y.XmlFragment for script content
  const getScriptFragment = useCallback(() => {
    return docRef.current?.getXmlFragment("script") || null;
  }, []);

  // Helper: update cursor position in awareness
  const updateCursor = useCallback(
    (lineId: string | null, field?: "text" | "character" | "title" | null) => {
      if (providerRef.current) {
        const current = providerRef.current.awareness.getLocalState();
        providerRef.current.awareness.setLocalState({
          ...current,
          cursor: lineId ? { lineId, field: field || null } : null,
        });
      }
    },
    []
  );

  return {
    ...state,
    getCuesMap,
    getScriptFragment,
    updateCursor,
  };
}
