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
  routeType?: "blitz" | "man" | "zone";
  isPrimary?: boolean;
  isMotion?: boolean;
  color?: string;
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
}

const STORAGE_KEY = "rc_draft_play";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setDraft(defaultDraft);
  }, []);

  const hasDraft = draft.players.length > 0 || draft.routes.length > 0;

  return {
    draft,
    isLoaded,
    hasDraft,
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
    clearDraft,
  };
}
