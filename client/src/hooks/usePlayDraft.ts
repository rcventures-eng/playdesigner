import { useState, useEffect, useCallback } from "react";

export interface DraftPlayer {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  side: "offense" | "defense";
}

export interface DraftRoute {
  id: string;
  playerId: string;
  points: { x: number; y: number }[];
  style: "straight" | "curved";
  routeType?: "pass" | "run" | "block" | "blitz" | "man" | "zone";
  isPrimary?: boolean;
  isMotion?: boolean;
  color?: string;
  targetPlayerId?: string; // For Man coverage - ID of the offensive player being covered
}

export interface DraftShape {
  id: string;
  playerId?: string;
  type: "oval";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface DraftPlayNote {
  id: string;
  text: string;
  x: number;
  y: number;
  backgroundColor: string;
}

export interface DraftFootball {
  id: string;
  x: number;
  y: number;
  hasPlayAction?: boolean;
}

export interface PlayDraft {
  players: DraftPlayer[];
  routes: DraftRoute[];
  shapes: DraftShape[];
  playNotes: DraftPlayNote[];
  footballs: DraftFootball[];
  format: string;
  name: string;
  situationTags: string[];
  conceptTags: string[];
  timestamp: number;
  isRPO?: boolean;
  isPlayAction?: boolean;
}

const STORAGE_KEY = "rc_draft_play";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_HISTORY_SIZE = 50; // Max undo steps

interface UndoSnapshot {
  players: DraftPlayer[];
  routes: DraftRoute[];
}

const defaultDraft: PlayDraft = {
  players: [],
  routes: [],
  shapes: [],
  playNotes: [],
  footballs: [],
  format: "",
  name: "",
  situationTags: [],
  conceptTags: [],
  timestamp: Date.now(),
};

export function usePlayDraft() {
  const [draft, setDraft] = useState<PlayDraft>(defaultDraft);
  const [isLoaded, setIsLoaded] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  // Load draft from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: PlayDraft = JSON.parse(stored);
        // Check if draft is still valid (less than 24 hours old)
        if (Date.now() - parsed.timestamp < EXPIRY_MS) {
          setDraft(parsed);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setIsLoaded(true);
  }, []);

  // Persist draft to sessionStorage when it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    const hasContent = draft.players.length > 0 || 
                       draft.routes.length > 0 || 
                       draft.name.trim() !== "";
    
    if (hasContent) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...draft, timestamp: Date.now() })
      );
    }
  }, [draft, isLoaded]);

  const updateDraft = useCallback((updates: Partial<PlayDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  }, []);

  const setPlayers = useCallback((players: DraftPlayer[]) => {
    setDraft((prev) => ({ ...prev, players }));
  }, []);

  const setRoutes = useCallback((routes: DraftRoute[]) => {
    setDraft((prev) => ({ ...prev, routes }));
  }, []);

  const setShapes = useCallback((shapes: DraftShape[]) => {
    setDraft((prev) => ({ ...prev, shapes }));
  }, []);

  const setPlayNotes = useCallback((playNotes: DraftPlayNote[]) => {
    setDraft((prev) => ({ ...prev, playNotes }));
  }, []);

  const setFootballs = useCallback((footballs: DraftFootball[]) => {
    setDraft((prev) => ({ ...prev, footballs }));
  }, []);

  const setFormat = useCallback((format: string) => {
    setDraft((prev) => ({ ...prev, format }));
  }, []);

  const setName = useCallback((name: string) => {
    setDraft((prev) => ({ ...prev, name }));
  }, []);

  const setSituationTags = useCallback((situationTags: string[]) => {
    setDraft((prev) => ({ ...prev, situationTags }));
  }, []);

  const setConceptTags = useCallback((conceptTags: string[]) => {
    setDraft((prev) => ({ ...prev, conceptTags }));
  }, []);

  const setIsRPO = useCallback((isRPO: boolean) => {
    setDraft((prev) => ({ 
      ...prev, 
      isRPO,
      // Mutual exclusivity: turn off PA if RPO is turned on
      isPlayAction: isRPO ? false : prev.isPlayAction
    }));
  }, []);

  const setIsPlayAction = useCallback((isPlayAction: boolean) => {
    setDraft((prev) => ({ 
      ...prev, 
      isPlayAction,
      // Mutual exclusivity: turn off RPO if PA is turned on
      isRPO: isPlayAction ? false : prev.isRPO
    }));
  }, []);

  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setDraft(defaultDraft);
    setUndoStack([]);
  }, []);

  // Push current state to undo stack before making changes
  // Uses functional update pattern to get latest draft state
  const pushToUndoStack = useCallback(() => {
    // Read current draft directly via setDraft functional pattern
    // to avoid stale closure issues
    setDraft((currentDraft) => {
      // Push snapshot to undo stack
      setUndoStack((prevStack) => {
        const snapshot: UndoSnapshot = {
          players: JSON.parse(JSON.stringify(currentDraft.players)),
          routes: JSON.parse(JSON.stringify(currentDraft.routes)),
        };
        const newStack = [...prevStack, snapshot];
        // Limit stack size
        if (newStack.length > MAX_HISTORY_SIZE) {
          return newStack.slice(-MAX_HISTORY_SIZE);
        }
        return newStack;
      });
      // Return unchanged draft - we're just reading it
      return currentDraft;
    });
  }, []);

  // Undo the last change - restores both players and routes
  const undo = useCallback(() => {
    if (undoStack.length === 0) return false;
    
    setUndoStack((prev) => {
      const newStack = [...prev];
      const snapshot = newStack.pop();
      if (snapshot) {
        setDraft((prevDraft) => ({
          ...prevDraft,
          players: snapshot.players,
          routes: snapshot.routes,
        }));
      }
      return newStack;
    });
    return true;
  }, [undoStack.length]);

  const canUndo = undoStack.length > 0;
  const hasDraft = draft.players.length > 0 || draft.routes.length > 0;

  return {
    draft,
    isLoaded,
    hasDraft,
    canUndo,
    updateDraft,
    setPlayers,
    setRoutes,
    setShapes,
    setPlayNotes,
    setFootballs,
    setFormat,
    setName,
    setSituationTags,
    setConceptTags,
    setIsRPO,
    setIsPlayAction,
    clearDraft,
    pushToUndoStack,
    undo,
  };
}
