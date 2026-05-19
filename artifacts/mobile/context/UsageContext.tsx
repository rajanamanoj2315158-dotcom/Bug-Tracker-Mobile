import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type AppCategory = "social" | "entertainment" | "productive" | "gaming" | "communication" | "news" | "other";
export type BlockTrigger =
  | "always" | "scheduled" | "study_mode" | "deep_work" | "monk_mode" | "detox_mode"
  | "sleep_hours" | "usage_limit" | "exam_mode" | "weekdays_only" | "weekends_only" | "alternate_days";

export const TRIGGER_META: Record<BlockTrigger, { label: string; icon: string; color: string; desc: string }> = {
  always: { label: "Always", icon: "slash", color: "#ef4444", desc: "Block at all times" },
  scheduled: { label: "Scheduled", icon: "clock", color: "#38bdf8", desc: "Block between set times" },
  study_mode: { label: "Study Mode", icon: "book-open", color: "#f59e0b", desc: "Block during study sessions" },
  deep_work: { label: "Deep Work", icon: "anchor", color: "#6366f1", desc: "Block during deep work sessions" },
  monk_mode: { label: "Monk Mode", icon: "moon", color: "#8b5cf6", desc: "Block during monk mode sessions" },
  detox_mode: { label: "Detox Mode", icon: "x-circle", color: "#ec4899", desc: "Block during dopamine detox" },
  sleep_hours: { label: "Sleep Hours", icon: "moon", color: "#818cf8", desc: "Block between your sleep times" },
  usage_limit: { label: "Usage Limit", icon: "activity", color: "#f97316", desc: "Block after daily limit exceeded" },
  exam_mode: { label: "Exam Mode", icon: "alert-circle", color: "#ef4444", desc: "Block during exam sessions" },
  weekdays_only: { label: "Weekdays Only", icon: "briefcase", color: "#22c55e", desc: "Mon-Fri blocking" },
  weekends_only: { label: "Weekends Only", icon: "coffee", color: "#a855f7", desc: "Sat-Sun blocking" },
  alternate_days: { label: "Alternate Days", icon: "repeat", color: "#64748b", desc: "Every other day" },
};

export interface AppBlockConfig {
  triggers: BlockTrigger[];
  startTime: string;
  endTime: string;
  days: number[];
  dailyLimitMin: number;
  emergencyAllowed: boolean;
  permanent: boolean;
}
export interface AppEntry { name: string; category: AppCategory; blocked: boolean; blockConfig: AppBlockConfig; }
export interface BlockRule { id: string; type: "website" | "keyword"; value: string; enabled: boolean; }
export interface WhitelistEntry { name: string; icon: string; }
export interface TimetableSlot {
  id: string; dayOfWeek: number; startTime: string; endTime: string; label: string;
  type: "focus" | "break" | "sleep" | "study" | "exercise" | "free";
}
export interface EmergencyUnlock { unlockedAt: number; cooldownMs: number; }
export interface DistractionAttempt { appName: string; attemptedAt: number; sessionMode?: string; }

export interface StrictModeSession {
  schemaVersion: number;
  id: string;
  startTime: number;
  endTime: number;
  mode: "pomodoro" | "deep_work" | "custom";
  blockedApp: string;
  bypassAttempts: number;
  emergencyUnlockUsedAt: number | null;
}

export interface StartSessionParams {
  durationMs: number;
  mode: StrictModeSession["mode"];
  blockedApp?: string;
}

const DEFAULT_BLOCK_CONFIG = (): AppBlockConfig => ({
  triggers: [], startTime: "09:00", endTime: "22:00", days: [1, 2, 3, 4, 5], dailyLimitMin: 30, emergencyAllowed: false, permanent: false,
});
const DEFAULT_APPS: AppEntry[] = [
  { name: "Instagram", category: "social", blocked: true, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["always"], permanent: true } },
  { name: "TikTok", category: "social", blocked: true, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["always"], permanent: true } },
  { name: "YouTube", category: "entertainment", blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["scheduled", "study_mode"], startTime: "08:00", endTime: "22:00", dailyLimitMin: 30 } },
  { name: "Twitter / X", category: "social", blocked: true, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["always"], permanent: true } },
  { name: "Reddit", category: "social", blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["study_mode", "deep_work", "weekdays_only"] } },
];
const CATEGORY_COLORS: Record<AppCategory, string> = {
  social: "#f43f5e", entertainment: "#f59e0b", productive: "#22c55e", gaming: "#a855f7", communication: "#38bdf8", news: "#64748b", other: "#475569",
};

const APPS_KEY = "fs_apps_v3";
const RULES_KEY = "fs_rules_v3";
const WHITELIST_KEY = "fs_whitelist_v2";
const TIMETABLE_KEY = "fs_timetable_v2";
const SETTINGS_KEY = "fs_settings_v2";
const DISTRACTION_KEY = "fs_distraction_log";
const STRICT_SESSION_KEY = "@strict_session_v2";
const SCHEMA_VERSION = 2;
const MAX_LOG_ENTRIES = 500;
const EMERGENCY_COOLDOWN_MS = 30 * 60 * 1000;
const MANUAL_STRICT_DURATION_MS = 90 * 60 * 1000;

interface UsageContextValue {
  apps: AppEntry[];
  blockRules: BlockRule[];
  whitelist: WhitelistEntry[];
  timetable: TimetableSlot[];
  distractionLog: DistractionAttempt[];
  emergencyUnlock: EmergencyUnlock | null;
  lockModeEnabled: boolean;
  strictModeEnabled: boolean;
  activeSession: StrictModeSession | null;
  todayDistractionCount: number;
  blockedApps: AppEntry[];
  categoryColors: typeof CATEGORY_COLORS;
  disciplineScore: number;
  todayUsageByCategory: Record<AppCategory, number>;
  addApp: (app: AppEntry) => void;
  removeApp: (name: string) => void;
  toggleAppBlocked: (name: string) => void;
  updateAppConfig: (name: string, config: Partial<AppBlockConfig>) => void;
  addBlockRule: (rule: Omit<BlockRule, "id">) => void;
  removeBlockRule: (id: string) => void;
  toggleBlockRule: (id: string) => void;
  addToWhitelist: (entry: WhitelistEntry) => void;
  removeFromWhitelist: (name: string) => void;
  addTimetableSlot: (slot: Omit<TimetableSlot, "id">) => void;
  removeTimetableSlot: (id: string) => void;
  logDistractionAttempt: (appName: string, sessionMode?: string) => void;
  triggerEmergencyUnlock: () => boolean;
  setLockMode: (enabled: boolean) => void;
  setStrictMode: (enabled: boolean) => void;
  defaultBlockConfig: () => AppBlockConfig;
  startStrictSession: (params: StartSessionParams) => Promise<void>;
  endStrictSession: () => Promise<void>;
  recordBypassAttempt: () => Promise<void>;
  requestEmergencyUnlock: () => { allowed: boolean; cooldownRemainingMs: number };
  confirmEmergencyUnlock: () => Promise<void>;
  clearDistractionLog: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue | null>(null);

function createWriteQueue() {
  let tail: Promise<void> = Promise.resolve();
  return { enqueue(task: () => Promise<void>) { tail = tail.then(task, task); return tail; } };
}

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const [apps, setApps] = useState<AppEntry[]>(DEFAULT_APPS);
  const [blockRules, setBlockRules] = useState<BlockRule[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([
    { name: "Phone", icon: "phone" }, { name: "Messages", icon: "message-circle" }, { name: "Calculator", icon: "hash" }, { name: "Notes", icon: "file-text" }, { name: "Camera", icon: "camera" },
  ]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [distractionLog, setDistractionLog] = useState<DistractionAttempt[]>([]);
  const [emergencyUnlock, setEmergencyUnlock] = useState<EmergencyUnlock | null>(null);
  const [lockModeEnabled, setLockModeEnabled] = useState(false);
  const [activeSession, setActiveSession] = useState<StrictModeSession | null>(null);
  const queue = useRef(createWriteQueue());

  const strictModeEnabled = activeSession !== null;

  useEffect(() => {
    (async () => {
      try {
        const [a, r, w, t, s, d, rawSession] = await Promise.all([
          AsyncStorage.getItem(APPS_KEY), AsyncStorage.getItem(RULES_KEY), AsyncStorage.getItem(WHITELIST_KEY),
          AsyncStorage.getItem(TIMETABLE_KEY), AsyncStorage.getItem(SETTINGS_KEY), AsyncStorage.getItem(DISTRACTION_KEY),
          AsyncStorage.getItem(STRICT_SESSION_KEY),
        ]);
        if (a) setApps(JSON.parse(a));
        if (r) setBlockRules(JSON.parse(r));
        if (w) setWhitelist(JSON.parse(w));
        if (t) setTimetable(JSON.parse(t));
        if (d) setDistractionLog(JSON.parse(d));
        if (s) {
          const p = JSON.parse(s);
          if (p.lockMode !== undefined) setLockModeEnabled(p.lockMode);
          if (p.emergencyUnlock) setEmergencyUnlock(p.emergencyUnlock);
        }
        if (rawSession) {
          const session: StrictModeSession = JSON.parse(rawSession);
          if (session.schemaVersion === SCHEMA_VERSION && session.endTime > Date.now()) {
            setActiveSession(session);
          } else {
            await AsyncStorage.removeItem(STRICT_SESSION_KEY);
          }
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    const ms = activeSession.endTime - Date.now();
    if (ms <= 0) {
      setActiveSession(null);
      queue.current.enqueue(() => AsyncStorage.removeItem(STRICT_SESSION_KEY));
      return;
    }
    const t = setTimeout(() => {
      setActiveSession(null);
      queue.current.enqueue(() => AsyncStorage.removeItem(STRICT_SESSION_KEY));
    }, ms);
    return () => clearTimeout(t);
  }, [activeSession]);

  const save = useCallback(<T,>(key: string, val: T) => {
    queue.current.enqueue(async () => { try { await AsyncStorage.setItem(key, JSON.stringify(val)); } catch {} });
  }, []);

  const persistSettings = useCallback((next: { lockMode: boolean; strictMode: boolean; emergencyUnlock: EmergencyUnlock | null }) => {
    save(SETTINGS_KEY, next);
  }, [save]);

  const persistSession = useCallback((session: StrictModeSession | null) => {
    queue.current.enqueue(async () => {
      try {
        if (session) await AsyncStorage.setItem(STRICT_SESSION_KEY, JSON.stringify(session));
        else await AsyncStorage.removeItem(STRICT_SESSION_KEY);
      } catch {}
    });
  }, []);

  const addApp = useCallback((app: AppEntry) => {
    setApps((prev) => {
      if (prev.some((a) => a.name === app.name)) return prev;
      const next = [...prev, app];
      save(APPS_KEY, next);
      return next;
    });
  }, [save]);
  const removeApp = useCallback((name: string) => {
    setApps((prev) => {
      const next = prev.filter((a) => a.name !== name);
      save(APPS_KEY, next);
      return next;
    });
  }, [save]);
  const toggleAppBlocked = useCallback((name: string) => {
    setApps((prev) => {
      const next = prev.map((a) => {
        if (a.name !== name) return a;
        if (a.blockConfig.permanent && a.blocked) return a;
        return { ...a, blocked: !a.blocked };
      });
      save(APPS_KEY, next);
      return next;
    });
  }, [save]);
  const updateAppConfig = useCallback((name: string, config: Partial<AppBlockConfig>) => {
    setApps((prev) => {
      const next = prev.map((a) => a.name === name ? { ...a, blockConfig: { ...a.blockConfig, ...config } } : a);
      save(APPS_KEY, next);
      return next;
    });
  }, [save]);

  const addBlockRule = useCallback((rule: Omit<BlockRule, "id">) => {
    const item: BlockRule = { ...rule, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    setBlockRules((prev) => {
      const next = [...prev, item];
      save(RULES_KEY, next);
      return next;
    });
  }, [save]);
  const removeBlockRule = useCallback((id: string) => {
    setBlockRules((prev) => {
      const next = prev.filter((r) => r.id !== id);
      save(RULES_KEY, next);
      return next;
    });
  }, [save]);
  const toggleBlockRule = useCallback((id: string) => {
    setBlockRules((prev) => {
      const next = prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r);
      save(RULES_KEY, next);
      return next;
    });
  }, [save]);

  const addToWhitelist = useCallback((entry: WhitelistEntry) => {
    setWhitelist((prev) => {
      if (prev.some((w) => w.name === entry.name)) return prev;
      const next = [...prev, entry];
      save(WHITELIST_KEY, next);
      return next;
    });
  }, [save]);
  const removeFromWhitelist = useCallback((name: string) => {
    setWhitelist((prev) => {
      const next = prev.filter((w) => w.name !== name);
      save(WHITELIST_KEY, next);
      return next;
    });
  }, [save]);

  const addTimetableSlot = useCallback((slot: Omit<TimetableSlot, "id">) => {
    const item: TimetableSlot = { ...slot, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    setTimetable((prev) => {
      const next = [...prev, item];
      save(TIMETABLE_KEY, next);
      return next;
    });
  }, [save]);
  const removeTimetableSlot = useCallback((id: string) => {
    setTimetable((prev) => {
      const next = prev.filter((s) => s.id !== id);
      save(TIMETABLE_KEY, next);
      return next;
    });
  }, [save]);

  const logDistractionAttempt = useCallback((appName: string, sessionMode?: string) => {
    setDistractionLog((prev) => {
      const next = [{ appName, attemptedAt: Date.now(), sessionMode }, ...prev].slice(0, MAX_LOG_ENTRIES);
      save(DISTRACTION_KEY, next);
      return next;
    });
  }, [save]);

  const setLockMode = useCallback((enabled: boolean) => {
    setLockModeEnabled(enabled);
    persistSettings({ lockMode: enabled, strictMode: strictModeEnabled, emergencyUnlock });
  }, [strictModeEnabled, emergencyUnlock, persistSettings]);

  const startStrictSession = useCallback(async ({ durationMs, mode, blockedApp = "" }: StartSessionParams) => {
    const now = Date.now();
    const session: StrictModeSession = {
      schemaVersion: SCHEMA_VERSION,
      id: `session_${now}_${Math.random().toString(36).slice(2, 8)}`,
      startTime: now,
      endTime: now + durationMs,
      mode,
      blockedApp,
      bypassAttempts: 0,
      emergencyUnlockUsedAt: null,
    };
    setActiveSession(session);
    persistSession(session);
    persistSettings({ lockMode: lockModeEnabled, strictMode: true, emergencyUnlock });
  }, [persistSession, persistSettings, lockModeEnabled, emergencyUnlock]);

  const endStrictSession = useCallback(async () => {
    setActiveSession(null);
    persistSession(null);
    persistSettings({ lockMode: lockModeEnabled, strictMode: false, emergencyUnlock });
  }, [persistSession, persistSettings, lockModeEnabled, emergencyUnlock]);

  const setStrictMode = useCallback((enabled: boolean) => {
    if (enabled) {
      if (!activeSession) {
        startStrictSession({ durationMs: MANUAL_STRICT_DURATION_MS, mode: "custom", blockedApp: "Manual Strict Mode" });
      }
      persistSettings({ lockMode: lockModeEnabled, strictMode: true, emergencyUnlock });
      return;
    }
    endStrictSession();
  }, [activeSession, startStrictSession, lockModeEnabled, emergencyUnlock, persistSettings, endStrictSession]);

  const recordBypassAttempt = useCallback(async () => {
    setActiveSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, bypassAttempts: prev.bypassAttempts + 1 };
      persistSession(updated);
      logDistractionAttempt(prev.blockedApp || "StrictMode");
      return updated;
    });
  }, [persistSession, logDistractionAttempt]);

  const requestEmergencyUnlock = useCallback(() => {
    if (!activeSession) return { allowed: false, cooldownRemainingMs: 0 };
    const last = activeSession.emergencyUnlockUsedAt ?? emergencyUnlock?.unlockedAt ?? null;
    if (last === null) return { allowed: true, cooldownRemainingMs: 0 };
    const remaining = EMERGENCY_COOLDOWN_MS - (Date.now() - last);
    return remaining > 0 ? { allowed: false, cooldownRemainingMs: remaining } : { allowed: true, cooldownRemainingMs: 0 };
  }, [activeSession, emergencyUnlock]);

  const confirmEmergencyUnlock = useCallback(async () => {
    const unlock: EmergencyUnlock = { unlockedAt: Date.now(), cooldownMs: EMERGENCY_COOLDOWN_MS };
    setEmergencyUnlock(unlock);
    persistSettings({ lockMode: lockModeEnabled, strictMode: false, emergencyUnlock: unlock });
    setActiveSession(null);
    persistSession(null);
  }, [persistSettings, lockModeEnabled, persistSession]);

  const triggerEmergencyUnlock = useCallback((): boolean => {
    const remaining = requestEmergencyUnlock();
    if (!remaining.allowed) return false;
    const unlock: EmergencyUnlock = { unlockedAt: Date.now(), cooldownMs: EMERGENCY_COOLDOWN_MS };
    setEmergencyUnlock(unlock);
    persistSettings({ lockMode: lockModeEnabled, strictMode: false, emergencyUnlock: unlock });
    setActiveSession(null);
    persistSession(null);
    return true;
  }, [requestEmergencyUnlock, persistSettings, lockModeEnabled, persistSession]);

  const clearDistractionLog = useCallback(async () => {
    setDistractionLog([]);
    queue.current.enqueue(async () => { try { await AsyncStorage.removeItem(DISTRACTION_KEY); } catch {} });
  }, []);

  const blockedApps = useMemo(() => apps.filter((a) => a.blocked), [apps]);
  const todayDistractionCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return distractionLog.filter((d) => d.attemptedAt >= start.getTime()).length;
  }, [distractionLog]);
  const disciplineScore = useMemo(() => Math.min(100, Math.round(Math.max(0, 60 - todayDistractionCount * 5) + Math.min(40, blockedApps.length * 3))), [todayDistractionCount, blockedApps.length]);
  const todayUsageByCategory = useMemo(() => {
    const byCategory: Record<AppCategory, number> = { social: 0, entertainment: 0, productive: 0, gaming: 0, communication: 0, news: 0, other: 0 };
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const appMap = new Map(apps.map((a) => [a.name.toLowerCase(), a.category] as const));
    distractionLog.forEach((d) => {
      if (d.attemptedAt < start.getTime()) return;
      const cat = appMap.get(d.appName.toLowerCase()) ?? "other";
      byCategory[cat] += 1;
    });
    return byCategory;
  }, [apps, distractionLog]);

  const value: UsageContextValue = {
    apps, blockRules, whitelist, timetable, distractionLog, emergencyUnlock,
    lockModeEnabled, strictModeEnabled, activeSession, todayDistractionCount,
    blockedApps, categoryColors: CATEGORY_COLORS, disciplineScore, todayUsageByCategory,
    addApp, removeApp, toggleAppBlocked, updateAppConfig, addBlockRule, removeBlockRule, toggleBlockRule,
    addToWhitelist, removeFromWhitelist, addTimetableSlot, removeTimetableSlot, logDistractionAttempt,
    triggerEmergencyUnlock, setLockMode, setStrictMode, defaultBlockConfig: DEFAULT_BLOCK_CONFIG,
    startStrictSession, endStrictSession, recordBypassAttempt, requestEmergencyUnlock, confirmEmergencyUnlock, clearDistractionLog,
  };
  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
}

export function useUsage() {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error("useUsage must be used within UsageProvider");
  return ctx;
}
