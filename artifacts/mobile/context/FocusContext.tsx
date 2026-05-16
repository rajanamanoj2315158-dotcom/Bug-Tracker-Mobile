import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type SessionMode =
  | "pomodoro"
  | "study"
  | "deep"
  | "monk"
  | "detox"
  | "founder";

export interface SessionRecord {
  id: string;
  mode: SessionMode;
  durationMs: number;
  completedMs: number;
  startedAt: number;
  endedAt: number;
  completed: boolean;
  pomodoroSessions?: number;
}

export interface PomodoroState {
  cycle: number;
  phase: "work" | "short_break" | "long_break";
  completedCycles: number;
}

export interface ActiveSession {
  mode: SessionMode;
  durationMs: number;
  startedAt: number;
  remainingMs: number;
  paused: boolean;
  pomodoroState?: PomodoroState;
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlockedAt?: number;
}

const POMO_WORK_MS = 25 * 60 * 1000;
const POMO_SHORT_MS = 5 * 60 * 1000;
const POMO_LONG_MS = 30 * 60 * 1000;

const MODE_DURATIONS: Record<SessionMode, number> = {
  pomodoro: POMO_WORK_MS,
  study: 45 * 60 * 1000,
  deep: 90 * 60 * 1000,
  monk: 180 * 60 * 1000,
  detox: 120 * 60 * 1000,
  founder: 240 * 60 * 1000,
};

const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: "first_session", title: "First Step", desc: "Complete your first focus session", icon: "award" },
  { id: "streak_3", title: "Consistent", desc: "3-day focus streak", icon: "zap" },
  { id: "streak_7", title: "One Week", desc: "7-day focus streak", icon: "star" },
  { id: "streak_30", title: "Iron Will", desc: "30-day focus streak", icon: "shield" },
  { id: "deep_work_1", title: "Deep Diver", desc: "Complete a deep work session", icon: "anchor" },
  { id: "monk_1", title: "Monk Mind", desc: "Complete a monk mode session", icon: "moon" },
  { id: "founder_1", title: "Founder", desc: "Complete a founder mode session", icon: "briefcase" },
  { id: "total_10h", title: "10 Hours", desc: "Accumulate 10 hours of focus", icon: "clock" },
  { id: "total_50h", title: "50 Hours", desc: "Accumulate 50 hours of focus", icon: "trending-up" },
  { id: "pomodoro_4", title: "Tomato Farmer", desc: "Complete 4 pomodoro cycles", icon: "repeat" },
  { id: "perfect_day", title: "Perfect Day", desc: "Reach 100 productivity score", icon: "sun" },
  { id: "detox_1", title: "Digital Detox", desc: "Complete a dopamine detox session", icon: "x-circle" },
];

function getDayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FocusContextValue {
  sessions: SessionRecord[];
  currentSession: ActiveSession | null;
  achievements: Achievement[];
  startSession: (mode: SessionMode) => void;
  stopSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  skipPomodoroBreak: () => void;
  todayFocusMs: number;
  weekFocusMs: number;
  totalFocusMs: number;
  streak: number;
  bestStreak: number;
  totalSessions: number;
  level: number;
  productivityScore: number;
  todaySessions: SessionRecord[];
}

const FocusContext = createContext<FocusContextValue | null>(null);

const SESSIONS_KEY = "fs_sessions_v2";
const ACHIEVEMENTS_KEY = "fs_achievements";

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([
          AsyncStorage.getItem(SESSIONS_KEY),
          AsyncStorage.getItem(ACHIEVEMENTS_KEY),
        ]);
        if (s) setSessions(JSON.parse(s));
        if (a) setUnlockedIds(new Set(JSON.parse(a)));
      } catch {}
    })();
  }, []);

  const saveSessions = useCallback(async (s: SessionRecord[]) => {
    try { await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(s)); } catch {}
  }, []);

  const unlockAchievement = useCallback(async (id: string, prev: Set<string>) => {
    if (prev.has(id)) return prev;
    const next = new Set(prev).add(id);
    try { await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...next])); } catch {}
    return next;
  }, []);

  const checkAchievements = useCallback(async (
    allSessions: SessionRecord[],
    currentUnlocked: Set<string>
  ) => {
    let unlocked = currentUnlocked;
    const totalMs = allSessions.reduce((a, s) => a + s.completedMs, 0);
    const completedSessions = allSessions.filter((s) => s.completed);

    if (completedSessions.length >= 1) unlocked = await unlockAchievement("first_session", unlocked);
    if (totalMs >= 10 * 3600000) unlocked = await unlockAchievement("total_10h", unlocked);
    if (totalMs >= 50 * 3600000) unlocked = await unlockAchievement("total_50h", unlocked);
    if (completedSessions.some((s) => s.mode === "deep")) unlocked = await unlockAchievement("deep_work_1", unlocked);
    if (completedSessions.some((s) => s.mode === "monk")) unlocked = await unlockAchievement("monk_1", unlocked);
    if (completedSessions.some((s) => s.mode === "founder")) unlocked = await unlockAchievement("founder_1", unlocked);
    if (completedSessions.some((s) => s.mode === "detox")) unlocked = await unlockAchievement("detox_1", unlocked);
    if (completedSessions.some((s) => (s.pomodoroSessions ?? 0) >= 4)) {
      unlocked = await unlockAchievement("pomodoro_4", unlocked);
    }

    setUnlockedIds(unlocked);
  }, [unlockAchievement]);

  const stopTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const commitSession = useCallback(async (session: ActiveSession, completed: boolean, allSessions: SessionRecord[]) => {
    const elapsed = session.durationMs - session.remainingMs;
    if (elapsed < 10000 && !completed) return allSessions;
    const record: SessionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      mode: session.mode,
      durationMs: session.durationMs,
      completedMs: completed ? session.durationMs : elapsed,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      completed,
      pomodoroSessions: session.pomodoroState?.completedCycles,
    };
    const next = [record, ...allSessions];
    await saveSessions(next);
    return next;
  }, [saveSessions]);

  const startTick = useCallback(() => {
    stopTick();
    lastTickRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setCurrentSession((prev) => {
        if (!prev || prev.paused) return prev;

        const remaining = Math.max(0, prev.remainingMs - delta);

        if (remaining === 0) {
          stopTick();

          if (prev.mode === "pomodoro" && prev.pomodoroState) {
            const ps = prev.pomodoroState;

            if (ps.phase === "work") {
              const newCycles = ps.completedCycles + 1;
              const isLongBreak = newCycles % 4 === 0;
              const nextPhase = isLongBreak ? "long_break" : "short_break";
              const nextMs = isLongBreak ? POMO_LONG_MS : POMO_SHORT_MS;
              const updated: ActiveSession = {
                ...prev,
                remainingMs: nextMs,
                pomodoroState: { cycle: ps.cycle + 1, phase: nextPhase, completedCycles: newCycles },
              };
              setTimeout(() => startTick(), 100);
              return updated;
            } else {
              const nextWork: ActiveSession = {
                ...prev,
                remainingMs: POMO_WORK_MS,
                pomodoroState: { ...ps, phase: "work" },
              };
              setTimeout(() => startTick(), 100);
              return nextWork;
            }
          }

          setSessions((allSessions) => {
            commitSession(prev, true, allSessions).then((next) => {
              setSessions(next);
              checkAchievements(next, unlockedIds);
            });
            return allSessions;
          });
          return null;
        }

        return { ...prev, remainingMs: remaining };
      });
    }, 500);
  }, [stopTick, commitSession, checkAchievements, unlockedIds]);

  const startSession = useCallback((mode: SessionMode) => {
    stopTick();
    const durationMs = MODE_DURATIONS[mode];
    const session: ActiveSession = {
      mode,
      durationMs,
      startedAt: Date.now(),
      remainingMs: durationMs,
      paused: false,
      pomodoroState: mode === "pomodoro"
        ? { cycle: 1, phase: "work", completedCycles: 0 }
        : undefined,
    };
    setCurrentSession(session);
    setTimeout(() => startTick(), 50);
  }, [stopTick, startTick]);

  const stopSession = useCallback(() => {
    stopTick();
    setCurrentSession((prev) => {
      if (!prev) return null;
      setSessions((allSessions) => {
        commitSession(prev, false, allSessions).then((next) => {
          setSessions(next);
          checkAchievements(next, unlockedIds);
        });
        return allSessions;
      });
      return null;
    });
  }, [stopTick, commitSession, checkAchievements, unlockedIds]);

  const pauseSession = useCallback(() => {
    stopTick();
    setCurrentSession((prev) => prev ? { ...prev, paused: true } : prev);
  }, [stopTick]);

  const resumeSession = useCallback(() => {
    setCurrentSession((prev) => {
      if (!prev) return prev;
      const resumed = { ...prev, paused: false };
      setTimeout(() => startTick(), 50);
      return resumed;
    });
  }, [startTick]);

  const skipPomodoroBreak = useCallback(() => {
    setCurrentSession((prev) => {
      if (!prev?.pomodoroState) return prev;
      if (prev.pomodoroState.phase === "work") return prev;
      return { ...prev, remainingMs: POMO_WORK_MS, pomodoroState: { ...prev.pomodoroState, phase: "work" } };
    });
  }, []);

  const now = Date.now();
  const todayKey = getDayKey(now);
  const weekStart = now - 7 * 86400000;

  const todaySessions = sessions.filter((s) => getDayKey(s.startedAt) === todayKey);
  const todayFocusMs = todaySessions.reduce((a, s) => a + s.completedMs, 0);
  const weekFocusMs = sessions
    .filter((s) => s.startedAt >= weekStart)
    .reduce((a, s) => a + s.completedMs, 0);
  const totalFocusMs = sessions.reduce((a, s) => a + s.completedMs, 0);

  const streak = (() => {
    const days = new Set(sessions.map((s) => getDayKey(s.startedAt)));
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const key = getDayKey(now - i * 86400000);
      if (days.has(key)) count++;
      else if (i > 0) break;
    }
    return count;
  })();

  const bestStreak = (() => {
    const sorted = [...new Set(sessions.map((s) => getDayKey(s.startedAt)))].sort();
    let best = 0, cur = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { cur = 1; continue; }
      const prev = new Date(sorted[i - 1]).getTime() + 86400000;
      const curr = new Date(sorted[i]).getTime();
      if (Math.abs(prev - curr) < 86400000) cur++;
      else cur = 1;
      best = Math.max(best, cur);
    }
    return Math.max(best, cur);
  })();

  const level = Math.floor(totalFocusMs / (3600000 * 10)) + 1;

  const productivityScore = Math.min(100, Math.round(
    Math.min(75, todaySessions.filter((s) => s.completed).length * 15) +
    Math.min(15, streak * 1.5) +
    Math.min(10, todaySessions.length * 2)
  ));

  const achievements: Achievement[] = ALL_ACHIEVEMENTS.map((a) => ({
    ...a,
    unlockedAt: unlockedIds.has(a.id) ? 1 : undefined,
  }));

  return (
    <FocusContext.Provider
      value={{
        sessions,
        currentSession,
        achievements,
        startSession,
        stopSession,
        pauseSession,
        resumeSession,
        skipPomodoroBreak,
        todayFocusMs,
        weekFocusMs,
        totalFocusMs,
        streak,
        bestStreak,
        totalSessions: sessions.length,
        level,
        productivityScore,
        todaySessions,
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
