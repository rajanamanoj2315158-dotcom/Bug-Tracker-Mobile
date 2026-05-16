import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type AppCategory = "social" | "entertainment" | "productive" | "gaming" | "communication" | "news" | "other";

export type BlockTrigger =
  | "always"
  | "scheduled"
  | "study_mode"
  | "deep_work"
  | "monk_mode"
  | "detox_mode"
  | "sleep_hours"
  | "usage_limit"
  | "exam_mode"
  | "weekdays_only"
  | "weekends_only"
  | "alternate_days";

export const TRIGGER_META: Record<BlockTrigger, { label: string; icon: string; color: string; desc: string }> = {
  always:       { label: "Always",          icon: "slash",       color: "#ef4444", desc: "Block at all times" },
  scheduled:    { label: "Scheduled",       icon: "clock",       color: "#38bdf8", desc: "Block between set times" },
  study_mode:   { label: "Study Mode",      icon: "book-open",   color: "#f59e0b", desc: "Block during study sessions" },
  deep_work:    { label: "Deep Work",       icon: "anchor",      color: "#6366f1", desc: "Block during deep work sessions" },
  monk_mode:    { label: "Monk Mode",       icon: "moon",        color: "#8b5cf6", desc: "Block during monk mode sessions" },
  detox_mode:   { label: "Detox Mode",      icon: "x-circle",   color: "#ec4899", desc: "Block during dopamine detox" },
  sleep_hours:  { label: "Sleep Hours",     icon: "moon",        color: "#818cf8", desc: "Block between your sleep times" },
  usage_limit:  { label: "Usage Limit",     icon: "activity",   color: "#f97316", desc: "Block after daily limit exceeded" },
  exam_mode:    { label: "Exam Mode",       icon: "alert-circle",color: "#ef4444", desc: "Block during exam sessions" },
  weekdays_only:{ label: "Weekdays Only",   icon: "briefcase",  color: "#22c55e", desc: "Mon–Fri blocking" },
  weekends_only:{ label: "Weekends Only",   icon: "coffee",     color: "#a855f7", desc: "Sat–Sun blocking" },
  alternate_days:{ label: "Alternate Days", icon: "repeat",     color: "#64748b", desc: "Every other day" },
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

export interface AppEntry {
  name: string;
  category: AppCategory;
  blocked: boolean;
  blockConfig: AppBlockConfig;
}

export interface BlockRule {
  id: string;
  type: "website" | "keyword";
  value: string;
  enabled: boolean;
}

export interface WhitelistEntry {
  name: string;
  icon: string;
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

export interface DistractionAttempt {
  appName: string;
  attemptedAt: number;
  sessionMode?: string;
}

const DEFAULT_BLOCK_CONFIG = (): AppBlockConfig => ({
  triggers: [],
  startTime: "09:00",
  endTime: "22:00",
  days: [1, 2, 3, 4, 5],
  dailyLimitMin: 30,
  emergencyAllowed: false,
  permanent: false,
});

const DEFAULT_APPS: AppEntry[] = [
  { name: "Instagram",    category: "social",         blocked: true,  blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["always"], permanent: true } },
  { name: "TikTok",       category: "social",         blocked: true,  blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["always"], permanent: true } },
  { name: "YouTube",      category: "entertainment",  blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["scheduled", "study_mode"], startTime: "08:00", endTime: "22:00", dailyLimitMin: 30 } },
  { name: "Twitter / X",  category: "social",         blocked: true,  blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["always"], permanent: true } },
  { name: "Reddit",       category: "social",         blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["study_mode", "deep_work", "weekdays_only"] } },
  { name: "Facebook",     category: "social",         blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["scheduled"], startTime: "09:00", endTime: "20:00" } },
  { name: "Snapchat",     category: "social",         blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: [] } },
  { name: "Discord",      category: "communication",  blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["deep_work"] } },
  { name: "WhatsApp",     category: "communication",  blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["usage_limit"], dailyLimitMin: 30 } },
  { name: "Netflix",      category: "entertainment",  blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["monk_mode", "weekdays_only"] } },
  { name: "Spotify",      category: "entertainment",  blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: [] } },
  { name: "Gmail",        category: "productive",     blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: [] } },
  { name: "Notion",       category: "productive",     blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: [] } },
  { name: "Chrome",       category: "productive",     blocked: false, blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: [] } },
  { name: "PUBG",         category: "gaming",         blocked: true,  blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["always"], permanent: true } },
  { name: "Free Fire",    category: "gaming",         blocked: true,  blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["weekdays_only"] } },
  { name: "Clash of Clans",category: "gaming",        blocked: true,  blockConfig: { ...DEFAULT_BLOCK_CONFIG(), triggers: ["always"], permanent: true } },
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
  whitelist: WhitelistEntry[];
  timetable: TimetableSlot[];
  distractionLog: DistractionAttempt[];
  emergencyUnlock: EmergencyUnlock | null;
  lockModeEnabled: boolean;
  strictModeEnabled: boolean;
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
  blockedApps: AppEntry[];
  categoryColors: typeof CATEGORY_COLORS;
  disciplineScore: number;
  defaultBlockConfig: () => AppBlockConfig;
}

const UsageContext = createContext<UsageContextValue | null>(null);

const APPS_KEY = "fs_apps_v3";
const RULES_KEY = "fs_rules_v3";
const WHITELIST_KEY = "fs_whitelist_v2";
const TIMETABLE_KEY = "fs_timetable_v2";
const SETTINGS_KEY = "fs_settings_v2";
const DISTRACTION_KEY = "fs_distraction_log";

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const [apps, setApps] = useState<AppEntry[]>(DEFAULT_APPS);
  const [blockRules, setBlockRules] = useState<BlockRule[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([
    { name: "Phone", icon: "phone" },
    { name: "Messages", icon: "message-circle" },
    { name: "Calculator", icon: "hash" },
    { name: "Notes", icon: "file-text" },
    { name: "Camera", icon: "camera" },
  ]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [distractionLog, setDistractionLog] = useState<DistractionAttempt[]>([]);
  const [emergencyUnlock, setEmergencyUnlock] = useState<EmergencyUnlock | null>(null);
  const [lockModeEnabled, setLockModeEnabled] = useState(false);
  const [strictModeEnabled, setStrictModeEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, r, w, t, s, d] = await Promise.all([
          AsyncStorage.getItem(APPS_KEY),
          AsyncStorage.getItem(RULES_KEY),
          AsyncStorage.getItem(WHITELIST_KEY),
          AsyncStorage.getItem(TIMETABLE_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(DISTRACTION_KEY),
        ]);
        if (a) setApps(JSON.parse(a));
        if (r) setBlockRules(JSON.parse(r));
        if (w) setWhitelist(JSON.parse(w));
        if (t) setTimetable(JSON.parse(t));
        if (d) setDistractionLog(JSON.parse(d));
        if (s) {
          const p = JSON.parse(s);
          if (p.lockMode !== undefined) setLockModeEnabled(p.lockMode);
          if (p.strictMode !== undefined) setStrictModeEnabled(p.strictMode);
        }
      } catch {}
    })();
  }, []);

  const save = useCallback(<T>(key: string, val: T) => {
    try { AsyncStorage.setItem(key, JSON.stringify(val)); } catch {}
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
    setApps((prev) => { const n = prev.filter((a) => a.name !== name); save(APPS_KEY, n); return n; });
  }, [save]);

  const toggleAppBlocked = useCallback((name: string) => {
    setApps((prev) => {
      const n = prev.map((a) => a.name === name ? { ...a, blocked: !a.blocked } : a);
      save(APPS_KEY, n);
      return n;
    });
  }, [save]);

  const updateAppConfig = useCallback((name: string, config: Partial<AppBlockConfig>) => {
    setApps((prev) => {
      const n = prev.map((a) => a.name === name ? { ...a, blockConfig: { ...a.blockConfig, ...config } } : a);
      save(APPS_KEY, n);
      return n;
    });
  }, [save]);

  const addBlockRule = useCallback((rule: Omit<BlockRule, "id">) => {
    const nr: BlockRule = { ...rule, id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    setBlockRules((prev) => { const n = [...prev, nr]; save(RULES_KEY, n); return n; });
  }, [save]);

  const removeBlockRule = useCallback((id: string) => {
    setBlockRules((prev) => { const n = prev.filter((r) => r.id !== id); save(RULES_KEY, n); return n; });
  }, [save]);

  const toggleBlockRule = useCallback((id: string) => {
    setBlockRules((prev) => { const n = prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r); save(RULES_KEY, n); return n; });
  }, [save]);

  const addToWhitelist = useCallback((entry: WhitelistEntry) => {
    setWhitelist((prev) => {
      if (prev.some((w) => w.name === entry.name)) return prev;
      const n = [...prev, entry];
      save(WHITELIST_KEY, n);
      return n;
    });
  }, [save]);

  const removeFromWhitelist = useCallback((name: string) => {
    setWhitelist((prev) => { const n = prev.filter((w) => w.name !== name); save(WHITELIST_KEY, n); return n; });
  }, [save]);

  const addTimetableSlot = useCallback((slot: Omit<TimetableSlot, "id">) => {
    const ns: TimetableSlot = { ...slot, id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    setTimetable((prev) => { const n = [...prev, ns]; save(TIMETABLE_KEY, n); return n; });
  }, [save]);

  const removeTimetableSlot = useCallback((id: string) => {
    setTimetable((prev) => { const n = prev.filter((s) => s.id !== id); save(TIMETABLE_KEY, n); return n; });
  }, [save]);

  const logDistractionAttempt = useCallback((appName: string, sessionMode?: string) => {
    setDistractionLog((prev) => {
      const n = [{ appName, attemptedAt: Date.now(), sessionMode }, ...prev.slice(0, 99)];
      save(DISTRACTION_KEY, n);
      return n;
    });
  }, [save]);

  const triggerEmergencyUnlock = useCallback((): boolean => {
    const COOLDOWN_MS = 30 * 60 * 1000;
    if (emergencyUnlock && Date.now() - emergencyUnlock.unlockedAt < COOLDOWN_MS) return false;
    const unlock = { unlockedAt: Date.now(), cooldownMs: COOLDOWN_MS };
    setEmergencyUnlock(unlock);
    return true;
  }, [emergencyUnlock]);

  const setLockMode = useCallback((enabled: boolean) => {
    setLockModeEnabled(enabled);
    save(SETTINGS_KEY, { lockMode: enabled, strictMode: strictModeEnabled });
  }, [save, strictModeEnabled]);

  const setStrictMode = useCallback((enabled: boolean) => {
    setStrictModeEnabled(enabled);
    save(SETTINGS_KEY, { lockMode: lockModeEnabled, strictMode: enabled });
  }, [save, lockModeEnabled]);

  const blockedApps = apps.filter((a) => a.blocked);

  const disciplineScore = Math.min(100, Math.round(
    Math.max(0, 60 - distractionLog.filter((d) => {
      const ms = Date.now() - d.attemptedAt;
      return ms < 86400000;
    }).length * 5) +
    Math.min(40, blockedApps.length * 3)
  ));

  return (
    <UsageContext.Provider
      value={{
        apps, blockRules, whitelist, timetable, distractionLog, emergencyUnlock,
        lockModeEnabled, strictModeEnabled,
        addApp, removeApp, toggleAppBlocked, updateAppConfig,
        addBlockRule, removeBlockRule, toggleBlockRule,
        addToWhitelist, removeFromWhitelist,
        addTimetableSlot, removeTimetableSlot,
        logDistractionAttempt,
        triggerEmergencyUnlock,
        setLockMode, setStrictMode,
        blockedApps, categoryColors: CATEGORY_COLORS, disciplineScore,
        defaultBlockConfig: DEFAULT_BLOCK_CONFIG,
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
