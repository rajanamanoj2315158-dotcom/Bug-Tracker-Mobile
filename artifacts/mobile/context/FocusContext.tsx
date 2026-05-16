import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type SessionMode = "study" | "focus" | "deep";

export interface SessionRecord {
  id: string;
  mode: SessionMode;
  durationMs: number;
  completedMs: number;
  startedAt: number;
  endedAt: number;
  completed: boolean;
}

export interface ActiveSession {
  mode: SessionMode;
  durationMs: number;
  startedAt: number;
  remainingMs: number;
  paused: boolean;
}

interface FocusContextValue {
  sessions: SessionRecord[];
  blockedApps: string[];
  currentSession: ActiveSession | null;
  startSession: (mode: SessionMode, durationMs: number) => void;
  stopSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  addBlockedApp: (name: string) => void;
  removeBlockedApp: (name: string) => void;
  todayFocusMs: number;
  streak: number;
  totalSessions: number;
}

const FocusContext = createContext<FocusContextValue | null>(null);

const SESSIONS_KEY = "focus_sessions";
const APPS_KEY = "focus_blocked_apps";

function getDayKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [blockedApps, setBlockedApps] = useState<string[]>([
    "Instagram",
    "TikTok",
    "YouTube",
    "Twitter / X",
    "Reddit",
  ]);
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([
          AsyncStorage.getItem(SESSIONS_KEY),
          AsyncStorage.getItem(APPS_KEY),
        ]);
        if (s) setSessions(JSON.parse(s));
        if (a) setBlockedApps(JSON.parse(a));
      } catch {}
    })();
  }, []);

  const saveSessions = useCallback(async (s: SessionRecord[]) => {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(s));
  }, []);

  const saveApps = useCallback(async (a: string[]) => {
    await AsyncStorage.setItem(APPS_KEY, JSON.stringify(a));
  }, []);

  const startTick = useCallback((session: ActiveSession) => {
    if (tickRef.current) clearInterval(tickRef.current);
    lastTickRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setCurrentSession((prev) => {
        if (!prev || prev.paused) return prev;
        const remaining = Math.max(0, prev.remainingMs - delta);
        if (remaining === 0) {
          clearInterval(tickRef.current!);
          tickRef.current = null;
          const record: SessionRecord = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            mode: prev.mode,
            durationMs: prev.durationMs,
            completedMs: prev.durationMs,
            startedAt: prev.startedAt,
            endedAt: Date.now(),
            completed: true,
          };
          setSessions((prev2) => {
            const next = [record, ...prev2];
            saveSessions(next);
            return next;
          });
          return null;
        }
        return { ...prev, remainingMs: remaining };
      });
    }, 500);
  }, [saveSessions]);

  const startSession = useCallback((mode: SessionMode, durationMs: number) => {
    if (tickRef.current) clearInterval(tickRef.current);
    const session: ActiveSession = {
      mode,
      durationMs,
      startedAt: Date.now(),
      remainingMs: durationMs,
      paused: false,
    };
    setCurrentSession(session);
    startTick(session);
  }, [startTick]);

  const stopSession = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setCurrentSession((prev) => {
      if (!prev) return null;
      const elapsed = prev.durationMs - prev.remainingMs;
      if (elapsed > 10000) {
        const record: SessionRecord = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          mode: prev.mode,
          durationMs: prev.durationMs,
          completedMs: elapsed,
          startedAt: prev.startedAt,
          endedAt: Date.now(),
          completed: false,
        };
        setSessions((p) => {
          const next = [record, ...p];
          saveSessions(next);
          return next;
        });
      }
      return null;
    });
  }, [saveSessions]);

  const pauseSession = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setCurrentSession((prev) => prev ? { ...prev, paused: true } : prev);
  }, []);

  const resumeSession = useCallback(() => {
    setCurrentSession((prev) => {
      if (!prev) return prev;
      const resumed = { ...prev, paused: false };
      startTick(resumed);
      return resumed;
    });
  }, [startTick]);

  const addBlockedApp = useCallback((name: string) => {
    setBlockedApps((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      saveApps(next);
      return next;
    });
  }, [saveApps]);

  const removeBlockedApp = useCallback((name: string) => {
    setBlockedApps((prev) => {
      const next = prev.filter((a) => a !== name);
      saveApps(next);
      return next;
    });
  }, [saveApps]);

  const todayKey = getDayKey(Date.now());
  const todayFocusMs = sessions
    .filter((s) => getDayKey(s.startedAt) === todayKey)
    .reduce((acc, s) => acc + s.completedMs, 0);

  const streak = (() => {
    const days = new Set(sessions.map((s) => getDayKey(s.startedAt)));
    let count = 0;
    const now = Date.now();
    for (let i = 0; i < 365; i++) {
      const key = getDayKey(now - i * 86400000);
      if (days.has(key)) count++;
      else if (i > 0) break;
    }
    return count;
  })();

  return (
    <FocusContext.Provider
      value={{
        sessions,
        blockedApps,
        currentSession,
        startSession,
        stopSession,
        pauseSession,
        resumeSession,
        addBlockedApp,
        removeBlockedApp,
        todayFocusMs,
        streak,
        totalSessions: sessions.length,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used within FocusProvider");
  return ctx;
}
