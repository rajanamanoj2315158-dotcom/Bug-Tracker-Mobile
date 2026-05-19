import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useUsage } from "@/context/UsageContext";
import { getJson, isArray, isRecord, removeStorageItem, setJson } from "@/lib/storage";

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
  endsAt?: number;
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

function getDayIndex(ts: number) {
  const d = new Date(ts);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
}

interface PersistedActiveSession extends ActiveSession {
  schemaVersion?: number;
  savedAt?: number;
}

function restoreActiveSession(raw: PersistedActiveSession): ActiveSession | null {
  if (typeof raw.startedAt !== "number" || typeof raw.durationMs !== "number") return null;
  if (typeof raw.remainingMs !== "number" || typeof raw.paused !== "boolean") return null;
  if (!Number.isFinite(raw.durationMs) || raw.durationMs < 0) return null;
  if (!Number.isFinite(raw.remainingMs) || raw.remainingMs < 0) return null;

  const now = Date.now();

  if (raw.timerMode === "stopwatch") {
    const elapsedSinceSave = raw.paused ? 0 : Math.max(0, now - (raw.savedAt ?? now));
    return { ...raw, remainingMs: Math.max(0, raw.remainingMs + elapsedSinceSave) };
  }

  const remainingMs = raw.paused
    ? raw.remainingMs
    : raw.endsAt
      ? Math.max(0, raw.endsAt - now)
      : raw.remainingMs;

  if (!raw.paused && remainingMs <= 0) return null;
  return { ...raw, remainingMs };
}

function isExpiredActiveSession(raw: PersistedActiveSession) {
  const isOneShotTimer = raw.timerMode === undefined || raw.timerMode === "countdown";
  return isOneShotTimer && !raw.paused && typeof raw.endsAt === "number" && raw.endsAt <= Date.now();
}

function createSessionRecord(session: ActiveSession, completed: boolean, endedAt = Date.now()): SessionRecord | null {
  const elapsed = session.timerMode === "stopwatch"
    ? Math.max(0, session.remainingMs)
    : Math.max(0, session.durationMs - session.remainingMs);
  if (elapsed < 10000 && !completed) return null;

  return {
    id: `${endedAt}-${Math.random().toString(36).slice(2, 8)}`,
    mode: session.mode,
    durationMs: session.durationMs,
    completedMs: completed && session.timerMode !== "stopwatch" ? session.durationMs : elapsed,
    startedAt: session.startedAt,
    endedAt,
    completed,
    pomodoroSessions: session.pomodoroState?.completedCycles,
    customPresetName: session.customPresetName,
  };
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
const ACTIVE_SESSION_KEY = "fs_active_session_v2";
const ACTIVE_SESSION_SCHEMA_VERSION = 2;

function isPersistedActiveSession(value: unknown): value is PersistedActiveSession {
  return (
    isRecord(value) &&
    typeof value.mode === "string" &&
    typeof value.durationMs === "number" &&
    typeof value.startedAt === "number" &&
    typeof value.remainingMs === "number" &&
    typeof value.paused === "boolean"
  );
}

function asStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(DEFAULT_CUSTOM_PRESETS);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const restoredSessionRef = useRef(false);
  const didHydrateRef = useRef(false);
  const { startStrictSession, endStrictSession } = useUsage();

  const saveSessions = useCallback(async (s: SessionRecord[]) => {
    await setJson(SESSIONS_KEY, s);
  }, []);

  const saveActiveSession = useCallback(async (session: ActiveSession | null) => {
    if (!session) {
      await removeStorageItem(ACTIVE_SESSION_KEY);
      return;
    }

    const persisted: PersistedActiveSession = {
      ...session,
      schemaVersion: ACTIVE_SESSION_SCHEMA_VERSION,
      savedAt: Date.now(),
    };
    await setJson(ACTIVE_SESSION_KEY, persisted);
  }, []);

  const unlockAchievement = useCallback(async (id: string, prev: Set<string>) => {
    if (prev.has(id)) return prev;
    const next = new Set(prev).add(id);
    await setJson(ACHIEVEMENTS_KEY, [...next]);
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

  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    (async () => {
      try {
        const [loadedSessions, loadedUnlocked, loadedPresets, parsedActive] = await Promise.all([
          getJson<SessionRecord[]>(SESSIONS_KEY, [], isArray as (value: unknown) => value is SessionRecord[]),
          getJson<string[]>(ACHIEVEMENTS_KEY, [], asStringArray),
          getJson<CustomPreset[]>(PRESETS_KEY, DEFAULT_CUSTOM_PRESETS, isArray as (value: unknown) => value is CustomPreset[]),
          getJson<PersistedActiveSession | null>(ACTIVE_SESSION_KEY, null, (value): value is PersistedActiveSession | null => value === null || isPersistedActiveSession(value)),
        ]);
        const loadedUnlockedSet = new Set<string>(loadedUnlocked);
        setSessions(loadedSessions);
        setUnlockedIds(loadedUnlockedSet);
        setCustomPresets(loadedPresets);
        if (parsedActive) {
          const restored = restoreActiveSession(parsedActive);
          if (restored) {
            setCurrentSession(restored);
            restoredSessionRef.current = !restored.paused;
          } else if (isExpiredActiveSession(parsedActive)) {
            const expiredSession = { ...parsedActive, remainingMs: 0 };
            const record = createSessionRecord(expiredSession, true, parsedActive.endsAt ?? Date.now());
            const next = record ? [record, ...loadedSessions] : loadedSessions;
            setSessions(next);
            await saveSessions(next);
            await checkAchievements(next, loadedUnlockedSet);
            await removeStorageItem(ACTIVE_SESSION_KEY);
            await endStrictSession();
          } else {
            await removeStorageItem(ACTIVE_SESSION_KEY);
            await endStrictSession();
          }
        }
      } catch {}
    })();
  }, [checkAchievements, endStrictSession, saveSessions]);

  const stopTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  useEffect(() => () => stopTick(), [stopTick]);

  const commitSession = useCallback(async (session: ActiveSession, completed: boolean, allSessions: SessionRecord[]) => {
    const record = createSessionRecord(session, completed);
    if (!record) return allSessions;
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

        const remaining = prev.endsAt
          ? Math.max(0, prev.endsAt - now)
          : Math.max(0, prev.remainingMs - delta);

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
                durationMs: isLong ? longMs : shortMs,
                remainingMs: isLong ? longMs : shortMs,
                endsAt: Date.now() + (isLong ? longMs : shortMs),
                pomodoroState: { cycle: ps.cycle + 1, phase: isLong ? "long_break" : "short_break", completedCycles: newCycles },
              };
              saveActiveSession(updated);
              setTimeout(() => startTick(), 100);
              return updated;
            } else {
              const back: ActiveSession = { ...prev, durationMs: workMs, remainingMs: workMs, endsAt: Date.now() + workMs, pomodoroState: { ...ps, phase: "work" } };
              saveActiveSession(back);
              setTimeout(() => startTick(), 100);
              return back;
            }
          }

          // Interval mode: work → break loop
          if (prev.timerMode === "interval") {
            const phase = prev.pomodoroState?.phase ?? "work";
            const isWork = phase === "work";
            const nextMs = isWork ? (prev.customBreakMs ?? 0) : (prev.customWorkMs ?? POMO_WORK_MS);
            if (nextMs <= 0) {
              const fallbackMs = prev.customWorkMs ?? POMO_WORK_MS;
              const updated: ActiveSession = {
                ...prev,
                durationMs: fallbackMs,
                remainingMs: fallbackMs,
                endsAt: Date.now() + fallbackMs,
                pomodoroState: {
                  cycle: (prev.pomodoroState?.cycle ?? 1) + 1,
                  completedCycles: prev.pomodoroState?.completedCycles ?? 0,
                  phase: "work",
                },
              };
              saveActiveSession(updated);
              setTimeout(() => startTick(), 100);
              return updated;
            }
            const updated: ActiveSession = {
              ...prev,
              durationMs: nextMs,
              remainingMs: nextMs,
              endsAt: Date.now() + nextMs,
              pomodoroState: {
                cycle: (prev.pomodoroState?.cycle ?? 1) + 1,
                completedCycles: prev.pomodoroState?.completedCycles ?? 0,
                phase: isWork ? "short_break" : "work",
              },
            };
            saveActiveSession(updated);
            setTimeout(() => startTick(), 100);
            return updated;
          }

          setSessions((allSessions) => {
            commitSession(prev, true, allSessions).then((next) => {
              setSessions(next);
              checkAchievements(next, unlockedIds);
              saveActiveSession(null);
              endStrictSession();
            });
            return allSessions;
          });
          return null;
        }

        return { ...prev, remainingMs: remaining };
      });
    }, 500);
  }, [stopTick, commitSession, checkAchievements, unlockedIds, saveActiveSession, endStrictSession]);

  const startSession = useCallback((mode: SessionMode) => {
    stopTick();
    const durationMs = MODE_DURATIONS[mode];
    const session: ActiveSession = {
      mode,
      durationMs,
      startedAt: Date.now(),
      endsAt: Date.now() + durationMs,
      remainingMs: durationMs,
      paused: false,
      timerMode: mode === "pomodoro" ? "pomodoro" : "countdown",
      pomodoroState: mode === "pomodoro" ? { cycle: 1, phase: "work", completedCycles: 0 } : undefined,
    };
    setCurrentSession(session);
    saveActiveSession(session);
    if (mode === "deep" || mode === "monk" || mode === "detox" || mode === "founder") {
      startStrictSession({ durationMs, mode: mode === "deep" ? "deep_work" : "custom", blockedApp: mode });
    }
    setTimeout(() => startTick(), 50);
  }, [stopTick, startTick, startStrictSession, saveActiveSession]);

  const startCustomSession = useCallback((preset: CustomPreset) => {
    stopTick();
    const workMs = preset.durationMin * 60000;
    const breakMs = preset.breakMin * 60000;
    const isPomodoro = preset.timerMode === "pomodoro" || preset.timerMode === "interval";
    const session: ActiveSession = {
      mode: "custom",
      durationMs: workMs,
      startedAt: Date.now(),
      endsAt: preset.timerMode === "stopwatch" ? undefined : Date.now() + workMs,
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
    saveActiveSession(session);
    if (preset.strictMode) {
      startStrictSession({ durationMs: workMs, mode: preset.timerMode === "pomodoro" ? "pomodoro" : "custom", blockedApp: preset.name });
    }
    setTimeout(() => startTick(), 50);
  }, [stopTick, startTick, startStrictSession, saveActiveSession]);

  const stopSession = useCallback(() => {
    stopTick();
    setCurrentSession((prev) => {
      if (!prev) return null;
      setSessions((allSessions) => {
        commitSession(prev, false, allSessions).then((next) => {
          setSessions(next);
          checkAchievements(next, unlockedIds);
          saveActiveSession(null);
          endStrictSession();
        });
        return allSessions;
      });
      return null;
    });
  }, [stopTick, commitSession, checkAchievements, unlockedIds, saveActiveSession, endStrictSession]);

  const pauseSession = useCallback(() => {
    stopTick();
    setCurrentSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, paused: true };
      saveActiveSession(updated);
      return updated;
    });
  }, [stopTick, saveActiveSession]);

  const resumeSession = useCallback(() => {
    setCurrentSession((prev) => {
      if (!prev) return prev;
      setTimeout(() => startTick(), 50);
      const updated = { ...prev, paused: false, endsAt: prev.timerMode === "stopwatch" ? undefined : Date.now() + prev.remainingMs };
      saveActiveSession(updated);
      return updated;
    });
  }, [startTick, saveActiveSession]);

  const skipPomodoroBreak = useCallback(() => {
    setCurrentSession((prev) => {
      if (!prev?.pomodoroState) return prev;
      if (prev.pomodoroState.phase === "work") return prev;
      const workMs = prev.customWorkMs ?? POMO_WORK_MS;
      const updated: ActiveSession = { ...prev, durationMs: workMs, remainingMs: workMs, endsAt: Date.now() + workMs, pomodoroState: { ...prev.pomodoroState, phase: "work" } };
      saveActiveSession(updated);
      return updated;
    });
  }, [saveActiveSession]);

  useEffect(() => {
    if (!restoredSessionRef.current || !currentSession) return;
    restoredSessionRef.current = false;
    if (!currentSession.paused) {
      setTimeout(() => startTick(), 50);
    }
  }, [currentSession, startTick]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        saveActiveSession(currentSession);
      }
    });
    return () => sub.remove();
  }, [currentSession, saveActiveSession]);

  const addCustomPreset = useCallback((preset: Omit<CustomPreset, "id">) => {
    const np: CustomPreset = { ...preset, id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
    setCustomPresets((prev) => {
      const n = [...prev, np];
      setJson(PRESETS_KEY, n);
      return n;
    });
  }, []);

  const removeCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const n = prev.filter((p) => p.id !== id);
      setJson(PRESETS_KEY, n);
      return n;
    });
  }, []);

  const updateCustomPreset = useCallback((id: string, data: Partial<CustomPreset>) => {
    setCustomPresets((prev) => {
      const n = prev.map((p) => p.id === id ? { ...p, ...data } : p);
      setJson(PRESETS_KEY, n);
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
    const sorted = [...new Set(sessions.map((s) => getDayIndex(s.startedAt)))].sort((a, b) => a - b);
    let best = 0, cur = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { cur = 1; continue; }
      if (sorted[i] - sorted[i - 1] === 1) cur++;
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
