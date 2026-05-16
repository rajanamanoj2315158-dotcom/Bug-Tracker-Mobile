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
  | "founder"
  | "custom";

export type TimerMode = "countdown" | "pomodoro" | "stopwatch" | "interval";

export interface CustomPreset {
  id: string;
  name: string;
  icon: string;
  color: string;
  durationMin: number;
  breakMin: number;
  timerMode: TimerMode;
  strictMode: boolean;
  autoRepeat: boolean;
  ambientSound: string;
}

export interface SessionRecord {
  id: string;
  mode: SessionMode;
  durationMs: number;
  completedMs: number;
  startedAt: number;
  endedAt: number;
  completed: boolean;
  pomodoroSessions?: number;
  customPresetName?: string;
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
  customPresetId?: string;
  customPresetName?: string;
  customColor?: string;
  customWorkMs?: number;
  customBreakMs?: number;
  timerMode?: TimerMode;
  autoRepeat?: boolean;
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
  custom: 45 * 60 * 1000,
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
  { id: "custom_1", title: "Architect", desc: "Create and complete a custom session", icon: "settings" },
];

const DEFAULT_CUSTOM_PRESETS: CustomPreset[] = [
  { id: "study_45", name: "Study Session", icon: "book-open", color: "#38bdf8", durationMin: 45, breakMin: 10, timerMode: "countdown", strictMode: false, autoRepeat: false, ambientSound: "rain" },
  { id: "coding_120", name: "Coding Sprint", icon: "code", color: "#6366f1", durationMin: 120, breakMin: 15, timerMode: "countdown", strictMode: true, autoRepeat: false, ambientSound: "white" },
  { id: "exam_180", name: "Exam Lockdown", icon: "alert-circle", color: "#ef4444", durationMin: 180, breakMin: 0, timerMode: "countdown", strictMode: true, autoRepeat: false, ambientSound: "none" },
  { id: "reading_30", name: "Reading Mode", icon: "book", color: "#22c55e", durationMin: 30, breakMin: 5, timerMode: "pomodoro", strictMode: false, autoRepeat: true, ambientSound: "forest" },
  { id: "deep_work_marathon", name: "Marathon Focus", icon: "zap", color: "#f97316", durationMin: 240, breakMin: 20, timerMode: "interval", strictMode: true, autoRepeat: false, ambientSound: "white" },
  { id: "detox_6h", name: "Digital Detox", icon: "x-circle", color: "#ec4899", durationMin: 360, breakMin: 0, timerMode: "countdown", strictMode: true, autoRepeat: false, ambientSound: "none" },
];

function getDayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FocusContextValue {
  sessions: SessionRecord[];
  currentSession: ActiveSession | null;
  achievements: Achievement[];
  customPresets: CustomPreset[];
  startSession: (mode: SessionMode) => void;
  startCustomSession: (preset: CustomPreset) => void;
  stopSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  skipPomodoroBreak: () => void;
  addCustomPreset: (preset: Omit<CustomPreset, "id">) => void;
  removeCustomPreset: (id: string) => void;
  updateCustomPreset: (id: string, data: Partial<CustomPreset>) => void;
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
const PRESETS_KEY = "fs_custom_presets_v1";

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(DEFAULT_CUSTOM_PRESETS);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const [s, a, p] = await Promise.all([
          AsyncStorage.getItem(SESSIONS_KEY),
          AsyncStorage.getItem(ACHIEVEMENTS_KEY),
          AsyncStorage.getItem(PRESETS_KEY),
        ]);
        if (s) setSessions(JSON.parse(s));
        if (a) setUnlockedIds(new Set(JSON.parse(a)));
        if (p) setCustomPresets(JSON.parse(p));
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

  const checkAchievements = useCallback(async (allSessions: SessionRecord[], currentUnlocked: Set<string>) => {
    let unlocked = currentUnlocked;
    const totalMs = allSessions.reduce((a, s) => a + s.completedMs, 0);
    const completed = allSessions.filter((s) => s.completed);
    if (completed.length >= 1) unlocked = await unlockAchievement("first_session", unlocked);
    if (totalMs >= 10 * 3600000) unlocked = await unlockAchievement("total_10h", unlocked);
    if (totalMs >= 50 * 3600000) unlocked = await unlockAchievement("total_50h", unlocked);
    if (completed.some((s) => s.mode === "deep")) unlocked = await unlockAchievement("deep_work_1", unlocked);
    if (completed.some((s) => s.mode === "monk")) unlocked = await unlockAchievement("monk_1", unlocked);
    if (completed.some((s) => s.mode === "founder")) unlocked = await unlockAchievement("founder_1", unlocked);
    if (completed.some((s) => s.mode === "detox")) unlocked = await unlockAchievement("detox_1", unlocked);
    if (completed.some((s) => s.mode === "custom")) unlocked = await unlockAchievement("custom_1", unlocked);
    if (completed.some((s) => (s.pomodoroSessions ?? 0) >= 4)) unlocked = await unlockAchievement("pomodoro_4", unlocked);
    setUnlockedIds(unlocked);
  }, [unlockAchievement]);

  const stopTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const commitSession = useCallback(async (session: ActiveSession, completed: boolean, allSessions: SessionRecord[]) => {
    const elapsed = session.durationMs - session.remainingMs;
    if (elapsed < 10000 && !completed) return allSessions;
    const record: SessionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode: session.mode,
      durationMs: session.durationMs,
      completedMs: completed ? session.durationMs : elapsed,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      completed,
      pomodoroSessions: session.pomodoroState?.completedCycles,
      customPresetName: session.customPresetName,
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

        // Stopwatch mode: counts up
        if (prev.timerMode === "stopwatch") {
          return { ...prev, remainingMs: prev.remainingMs + delta };
        }

        const remaining = Math.max(0, prev.remainingMs - delta);

        if (remaining === 0) {
          stopTick();

          if (prev.pomodoroState && prev.timerMode === "pomodoro") {
            const ps = prev.pomodoroState;
            const workMs = prev.customWorkMs ?? POMO_WORK_MS;
            const shortMs = prev.customBreakMs ?? POMO_SHORT_MS;
            const longMs = prev.customBreakMs ? prev.customBreakMs * 3 : POMO_LONG_MS;

            if (ps.phase === "work") {
              const newCycles = ps.completedCycles + 1;
              const isLong = newCycles % 4 === 0;
              const updated: ActiveSession = {
                ...prev,
                remainingMs: isLong ? longMs : shortMs,
                pomodoroState: { cycle: ps.cycle + 1, phase: isLong ? "long_break" : "short_break", completedCycles: newCycles },
              };
              setTimeout(() => startTick(), 100);
              return updated;
            } else {
              const back: ActiveSession = { ...prev, remainingMs: workMs, pomodoroState: { ...ps, phase: "work" } };
              setTimeout(() => startTick(), 100);
              return back;
            }
          }

          // Interval mode: work → break loop
          if (prev.timerMode === "interval" && prev.customBreakMs) {
            const phase = prev.pomodoroState?.phase ?? "work";
            const isWork = phase === "work";
            const nextMs = isWork ? prev.customBreakMs : (prev.customWorkMs ?? POMO_WORK_MS);
            const updated: ActiveSession = {
              ...prev,
              remainingMs: nextMs,
              pomodoroState: {
                cycle: (prev.pomodoroState?.cycle ?? 1) + 1,
                completedCycles: prev.pomodoroState?.completedCycles ?? 0,
                phase: isWork ? "short_break" : "work",
              },
            };
            setTimeout(() => startTick(), 100);
            return updated;
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
      timerMode: mode === "pomodoro" ? "pomodoro" : "countdown",
      pomodoroState: mode === "pomodoro" ? { cycle: 1, phase: "work", completedCycles: 0 } : undefined,
    };
    setCurrentSession(session);
    setTimeout(() => startTick(), 50);
  }, [stopTick, startTick]);

  const startCustomSession = useCallback((preset: CustomPreset) => {
    stopTick();
    const workMs = preset.durationMin * 60000;
    const breakMs = preset.breakMin * 60000;
    const isPomodoro = preset.timerMode === "pomodoro" || preset.timerMode === "interval";
    const session: ActiveSession = {
      mode: "custom",
      durationMs: workMs,
      startedAt: Date.now(),
      remainingMs: preset.timerMode === "stopwatch" ? 0 : workMs,
      paused: false,
      timerMode: preset.timerMode,
      customPresetId: preset.id,
      customPresetName: preset.name,
      customColor: preset.color,
      customWorkMs: workMs,
      customBreakMs: breakMs,
      autoRepeat: preset.autoRepeat,
      pomodoroState: isPomodoro ? { cycle: 1, phase: "work", completedCycles: 0 } : undefined,
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
      setTimeout(() => startTick(), 50);
      return { ...prev, paused: false };
    });
  }, [startTick]);

  const skipPomodoroBreak = useCallback(() => {
    setCurrentSession((prev) => {
      if (!prev?.pomodoroState) return prev;
      if (prev.pomodoroState.phase === "work") return prev;
      const workMs = prev.customWorkMs ?? POMO_WORK_MS;
      return { ...prev, remainingMs: workMs, pomodoroState: { ...prev.pomodoroState, phase: "work" } };
    });
  }, []);

  const addCustomPreset = useCallback((preset: Omit<CustomPreset, "id">) => {
    const np: CustomPreset = { ...preset, id: `cp_${Date.now()}` };
    setCustomPresets((prev) => {
      const n = [...prev, np];
      try { AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(n)); } catch {}
      return n;
    });
  }, []);

  const removeCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const n = prev.filter((p) => p.id !== id);
      try { AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(n)); } catch {}
      return n;
    });
  }, []);

  const updateCustomPreset = useCallback((id: string, data: Partial<CustomPreset>) => {
    setCustomPresets((prev) => {
      const n = prev.map((p) => p.id === id ? { ...p, ...data } : p);
      try { AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(n)); } catch {}
      return n;
    });
  }, []);

  const now = Date.now();
  const todayKey = getDayKey(now);
  const weekStart = now - 7 * 86400000;

  const todaySessions = sessions.filter((s) => getDayKey(s.startedAt) === todayKey);
  const todayFocusMs = todaySessions.reduce((a, s) => a + s.completedMs, 0);
  const weekFocusMs = sessions.filter((s) => s.startedAt >= weekStart).reduce((a, s) => a + s.completedMs, 0);
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
      if (Math.abs(prev - curr) <= 1) cur++;
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
    <FocusContext.Provider value={{
      sessions, currentSession, achievements, customPresets,
      startSession, startCustomSession, stopSession, pauseSession, resumeSession, skipPomodoroBreak,
      addCustomPreset, removeCustomPreset, updateCustomPreset,
      todayFocusMs, weekFocusMs, totalFocusMs, streak, bestStreak,
      totalSessions: sessions.length, level, productivityScore, todaySessions,
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used within FocusProvider");
  return ctx;
}
