import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type AppCategory = "social" | "entertainment" | "productive" | "gaming" | "communication" | "news" | "other";

export interface AppEntry {
  name: string;
  category: AppCategory;
  blocked: boolean;
  dailyLimitMin?: number;
}

export interface BlockRule {
  id: string;
  type: "app" | "website" | "keyword";
  value: string;
  enabled: boolean;
  scheduleDays?: number[];
  scheduleStartTime?: string;
  scheduleEndTime?: string;
}

export interface UsageLog {
  date: string;
  appName: string;
  minutesUsed: number;
  category: AppCategory;
}

export interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
  type: "focus" | "break" | "sleep" | "study" | "exercise" | "free";
}

export interface EmergencyUnlock {
  unlockedAt: number;
  cooldownMs: number;
}

const DEFAULT_APPS: AppEntry[] = [
  { name: "Instagram", category: "social", blocked: true },
  { name: "TikTok", category: "social", blocked: true },
  { name: "YouTube", category: "entertainment", blocked: false, dailyLimitMin: 30 },
  { name: "Twitter / X", category: "social", blocked: true },
  { name: "Reddit", category: "social", blocked: false, dailyLimitMin: 20 },
  { name: "Facebook", category: "social", blocked: false },
  { name: "Snapchat", category: "social", blocked: false },
  { name: "Discord", category: "communication", blocked: false },
  { name: "Netflix", category: "entertainment", blocked: false, dailyLimitMin: 60 },
  { name: "Spotify", category: "entertainment", blocked: false },
  { name: "WhatsApp", category: "communication", blocked: false },
  { name: "Gmail", category: "productive", blocked: false },
  { name: "Notion", category: "productive", blocked: false },
  { name: "Chrome", category: "productive", blocked: false },
  { name: "Duolingo", category: "productive", blocked: false },
  { name: "PUBG", category: "gaming", blocked: true },
  { name: "Free Fire", category: "gaming", blocked: true },
];

const CATEGORY_COLORS: Record<AppCategory, string> = {
  social: "#f43f5e",
  entertainment: "#f59e0b",
  productive: "#22c55e",
  gaming: "#a855f7",
  communication: "#38bdf8",
  news: "#64748b",
  other: "#475569",
};

interface UsageContextValue {
  apps: AppEntry[];
  blockRules: BlockRule[];
  usageLogs: UsageLog[];
  timetable: TimetableSlot[];
  emergencyUnlock: EmergencyUnlock | null;
  lockModeEnabled: boolean;
  strictModeEnabled: boolean;
  addApp: (app: AppEntry) => void;
  removeApp: (name: string) => void;
  toggleAppBlocked: (name: string) => void;
  setAppLimit: (name: string, minutes: number) => void;
  addBlockRule: (rule: Omit<BlockRule, "id">) => void;
  removeBlockRule: (id: string) => void;
  toggleBlockRule: (id: string) => void;
  logUsage: (appName: string, category: AppCategory, minutes: number) => void;
  addTimetableSlot: (slot: Omit<TimetableSlot, "id">) => void;
  removeTimetableSlot: (id: string) => void;
  triggerEmergencyUnlock: () => boolean;
  setLockMode: (enabled: boolean) => void;
  setStrictMode: (enabled: boolean) => void;
  blockedApps: AppEntry[];
  categoryColors: typeof CATEGORY_COLORS;
  todayUsageByCategory: Record<AppCategory, number>;
}

const UsageContext = createContext<UsageContextValue | null>(null);

const APPS_KEY = "fs_apps_v2";
const RULES_KEY = "fs_rules_v2";
const LOGS_KEY = "fs_usage_logs";
const TIMETABLE_KEY = "fs_timetable";
const SETTINGS_KEY = "fs_usage_settings";

function getDayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const [apps, setApps] = useState<AppEntry[]>(DEFAULT_APPS);
  const [blockRules, setBlockRules] = useState<BlockRule[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [emergencyUnlock, setEmergencyUnlock] = useState<EmergencyUnlock | null>(null);
  const [lockModeEnabled, setLockModeEnabled] = useState(false);
  const [strictModeEnabled, setStrictModeEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, r, l, t, s] = await Promise.all([
          AsyncStorage.getItem(APPS_KEY),
          AsyncStorage.getItem(RULES_KEY),
          AsyncStorage.getItem(LOGS_KEY),
          AsyncStorage.getItem(TIMETABLE_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        if (a) setApps(JSON.parse(a));
        if (r) setBlockRules(JSON.parse(r));
        if (l) setUsageLogs(JSON.parse(l));
        if (t) setTimetable(JSON.parse(t));
        if (s) {
          const parsed = JSON.parse(s);
          if (parsed.lockMode !== undefined) setLockModeEnabled(parsed.lockMode);
          if (parsed.strictMode !== undefined) setStrictModeEnabled(parsed.strictMode);
        }
      } catch {}
    })();
  }, []);

  const saveApps = useCallback(async (a: AppEntry[]) => {
    try { await AsyncStorage.setItem(APPS_KEY, JSON.stringify(a)); } catch {}
  }, []);
  const saveRules = useCallback(async (r: BlockRule[]) => {
    try { await AsyncStorage.setItem(RULES_KEY, JSON.stringify(r)); } catch {}
  }, []);
  const saveLogs = useCallback(async (l: UsageLog[]) => {
    try { await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(l.slice(0, 500))); } catch {}
  }, []);
  const saveTimetable = useCallback(async (t: TimetableSlot[]) => {
    try { await AsyncStorage.setItem(TIMETABLE_KEY, JSON.stringify(t)); } catch {}
  }, []);
  const saveSettings = useCallback(async (lock: boolean, strict: boolean) => {
    try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ lockMode: lock, strictMode: strict })); } catch {}
  }, []);

  const addApp = useCallback((app: AppEntry) => {
    setApps((prev) => {
      if (prev.some((a) => a.name === app.name)) return prev;
      const next = [...prev, app];
      saveApps(next);
      return next;
    });
  }, [saveApps]);

  const removeApp = useCallback((name: string) => {
    setApps((prev) => {
      const next = prev.filter((a) => a.name !== name);
      saveApps(next);
      return next;
    });
  }, [saveApps]);

  const toggleAppBlocked = useCallback((name: string) => {
    setApps((prev) => {
      const next = prev.map((a) => a.name === name ? { ...a, blocked: !a.blocked } : a);
      saveApps(next);
      return next;
    });
  }, [saveApps]);

  const setAppLimit = useCallback((name: string, minutes: number) => {
    setApps((prev) => {
      const next = prev.map((a) => a.name === name ? { ...a, dailyLimitMin: minutes } : a);
      saveApps(next);
      return next;
    });
  }, [saveApps]);

  const addBlockRule = useCallback((rule: Omit<BlockRule, "id">) => {
    const newRule: BlockRule = { ...rule, id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    setBlockRules((prev) => {
      const next = [...prev, newRule];
      saveRules(next);
      return next;
    });
  }, [saveRules]);

  const removeBlockRule = useCallback((id: string) => {
    setBlockRules((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRules(next);
      return next;
    });
  }, [saveRules]);

  const toggleBlockRule = useCallback((id: string) => {
    setBlockRules((prev) => {
      const next = prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r);
      saveRules(next);
      return next;
    });
  }, [saveRules]);

  const logUsage = useCallback((appName: string, category: AppCategory, minutes: number) => {
    const entry: UsageLog = { date: getDayKey(Date.now()), appName, category, minutesUsed: minutes };
    setUsageLogs((prev) => {
      const next = [entry, ...prev];
      saveLogs(next);
      return next;
    });
  }, [saveLogs]);

  const addTimetableSlot = useCallback((slot: Omit<TimetableSlot, "id">) => {
    const newSlot: TimetableSlot = { ...slot, id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    setTimetable((prev) => {
      const next = [...prev, newSlot];
      saveTimetable(next);
      return next;
    });
  }, [saveTimetable]);

  const removeTimetableSlot = useCallback((id: string) => {
    setTimetable((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveTimetable(next);
      return next;
    });
  }, [saveTimetable]);

  const triggerEmergencyUnlock = useCallback((): boolean => {
    const COOLDOWN_MS = 30 * 60 * 1000;
    if (emergencyUnlock && Date.now() - emergencyUnlock.unlockedAt < COOLDOWN_MS) {
      return false;
    }
    setEmergencyUnlock({ unlockedAt: Date.now(), cooldownMs: COOLDOWN_MS });
    return true;
  }, [emergencyUnlock]);

  const setLockMode = useCallback((enabled: boolean) => {
    setLockModeEnabled(enabled);
    saveSettings(enabled, strictModeEnabled);
  }, [saveSettings, strictModeEnabled]);

  const setStrictMode = useCallback((enabled: boolean) => {
    setStrictModeEnabled(enabled);
    saveSettings(lockModeEnabled, enabled);
  }, [saveSettings, lockModeEnabled]);

  const today = getDayKey(Date.now());
  const todayLogs = usageLogs.filter((l) => l.date === today);
  const todayUsageByCategory = todayLogs.reduce((acc, log) => {
    acc[log.category] = (acc[log.category] ?? 0) + log.minutesUsed;
    return acc;
  }, {} as Record<AppCategory, number>);

  const blockedApps = apps.filter((a) => a.blocked);

  return (
    <UsageContext.Provider
      value={{
        apps,
        blockRules,
        usageLogs,
        timetable,
        emergencyUnlock,
        lockModeEnabled,
        strictModeEnabled,
        addApp,
        removeApp,
        toggleAppBlocked,
        setAppLimit,
        addBlockRule,
        removeBlockRule,
        toggleBlockRule,
        logUsage,
        addTimetableSlot,
        removeTimetableSlot,
        triggerEmergencyUnlock,
        setLockMode,
        setStrictMode,
        blockedApps,
        categoryColors: CATEGORY_COLORS,
        todayUsageByCategory,
      }}
    >
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage() {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error("useUsage must be used within UsageProvider");
  return ctx;
}
