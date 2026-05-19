import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { getJson, isArray, isRecord, removeStorageItem, setJson } from "@/lib/storage";

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

interface StrictReliabilityState {
  interruptionCount: number;
  lastInterruptionAt: number | null;
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
const DEFAULT_WHITELIST: WhitelistEntry[] = [
  { name: "Phone", icon: "phone" },
  { name: "Messages", icon: "message-circle" },
  { name: "Calculator", icon: "hash" },
  { name: "Notes", icon: "file-text" },
  { name: "Camera", icon: "camera" },
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
const STRICT_RELIABILITY_KEY = "fs_strict_reliability_v1";
const SCHEMA_VERSION = 2;
const MAX_LOG_ENTRIES = 500;
const EMERGENCY_COOLDOWN_MS = 30 * 60 * 1000;
const MANUAL_STRICT_DURATION_MS = 90 * 60 * 1000;
const SUSPENSION_RISK_MS = 2 * 60 * 1000;
const MIN_STRICT_DURATION_MS = 60 * 1000;
const MAX_STRICT_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_NAME_LENGTH = 60;
const MAX_RULE_LENGTH = 120;
const MAX_TIMETABLE_SLOTS = 200;
const MAX_APPS = 200;
const MAX_BLOCK_RULES = 200;
const MAX_WHITELIST = 100;
const MAX_STRICT_BYPASS_ATTEMPTS = 1000;
const MAX_RELIABILITY_INTERRUPTION_COUNT = 1000;
const MIN_EVENT_TIMESTAMP = Date.UTC(2020, 0, 1);
const MAX_EVENT_FUTURE_DRIFT_MS = 15 * 60 * 1000;
const APP_CATEGORIES = new Set<AppCategory>(["social", "entertainment", "productive", "gaming", "communication", "news", "other"]);
const TIMETABLE_TYPES = new Set<TimetableSlot["type"]>(["focus", "break", "sleep", "study", "exercise", "free"]);

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
  strictReliability: StrictReliabilityState;
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

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.min(1439, Math.max(0, h * 60 + m));
}

function cleanName(value: unknown, fallback = "Untitled") {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  return cleaned || fallback;
}

function isAppCategory(value: unknown): value is AppCategory {
  return typeof value === "string" && APP_CATEGORIES.has(value as AppCategory);
}

function isTimetableType(value: unknown): value is TimetableSlot["type"] {
  return typeof value === "string" && TIMETABLE_TYPES.has(value as TimetableSlot["type"]);
}

function isPlausibleEventTimestamp(value: unknown, now = Date.now()): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_EVENT_TIMESTAMP && value <= now + MAX_EVENT_FUTURE_DRIFT_MS;
}

function clampInteger(value: unknown, min: number, max: number, fallback = min) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function normalizeTime(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (!/^\d{2}:\d{2}$/.test(value)) return fallback;
  const [h, m] = value.split(":").map((n) => Number(n));
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sanitizeBlockConfig(config: unknown): AppBlockConfig {
  const defaults = DEFAULT_BLOCK_CONFIG();
  const source = isRecord(config) ? config : {};
  const rawTriggers = Array.isArray(source.triggers) ? source.triggers : defaults.triggers;
  const rawDays = Array.isArray(source.days) ? source.days : defaults.days;
  const triggers = rawTriggers.filter((trigger, index, all) => trigger in TRIGGER_META && all.indexOf(trigger) === index);
  const days = rawDays.filter((day, index, all) => Number.isInteger(day) && day >= 0 && day <= 6 && all.indexOf(day) === index);
  const dailyLimitMin = typeof source.dailyLimitMin === "number" ? source.dailyLimitMin : defaults.dailyLimitMin;
  return {
    ...defaults,
    triggers,
    startTime: normalizeTime(source.startTime, defaults.startTime),
    endTime: normalizeTime(source.endTime, defaults.endTime),
    days: days.length > 0 ? days : defaults.days,
    dailyLimitMin: Math.min(24 * 60, Math.max(1, Math.round(dailyLimitMin))),
    emergencyAllowed: source.emergencyAllowed === true,
    permanent: source.permanent === true,
  };
}

function sanitizeRuleValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_RULE_LENGTH);
}

function sanitizeAppEntry(app: unknown): AppEntry | null {
  if (!isRecord(app)) return null;
  return {
    name: cleanName(app.name, "App"),
    category: isAppCategory(app.category) ? app.category : "other",
    blocked: app.blocked === true,
    blockConfig: sanitizeBlockConfig(app.blockConfig),
  };
}

function sanitizeBlockRule(rule: unknown): BlockRule | null {
  if (!isRecord(rule) || (rule.type !== "website" && rule.type !== "keyword")) return null;
  const value = sanitizeRuleValue(rule.value);
  if (!value) return null;
  return {
    id: typeof rule.id === "string" && rule.id.trim() ? rule.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: rule.type,
    value,
    enabled: rule.enabled !== false,
  };
}

function sanitizeWhitelistEntry(entry: unknown): WhitelistEntry | null {
  if (!isRecord(entry)) return null;
  const name = cleanName(entry.name, "App");
  const icon = typeof entry.icon === "string" && entry.icon.trim() ? entry.icon.trim().slice(0, 40) : "shield";
  return { name, icon };
}

function sanitizeTimetableSlot(slot: unknown): TimetableSlot | null {
  if (!isRecord(slot)) return null;
  const dayOfWeek = typeof slot.dayOfWeek === "number" && Number.isInteger(slot.dayOfWeek) && slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6 ? slot.dayOfWeek : 1;
  return {
    id: typeof slot.id === "string" ? slot.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dayOfWeek,
    startTime: normalizeTime(slot.startTime, "09:00"),
    endTime: normalizeTime(slot.endTime, "10:00"),
    label: cleanName(slot.label, "Focus Block"),
    type: isTimetableType(slot.type) ? slot.type : "focus",
  };
}

function toRanges(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === end) return [{ start: 0, end: 1440 }];
  if (end > start) return [{ start, end }];
  return [{ start, end: 1440 }, { start: 0, end }];
}

function overlaps(a: TimetableSlot, b: TimetableSlot) {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  const aRanges = toRanges(a.startTime, a.endTime);
  const bRanges = toRanges(b.startTime, b.endTime);
  return aRanges.some((ar) => bRanges.some((br) => ar.start < br.end && br.start < ar.end));
}

function isSettings(value: unknown): value is { lockMode?: unknown; emergencyUnlock?: unknown } {
  return isRecord(value);
}

function isStrictModeSession(value: unknown): value is StrictModeSession {
  return (
    isRecord(value) &&
    value.schemaVersion === SCHEMA_VERSION &&
    typeof value.id === "string" &&
    typeof value.startTime === "number" &&
    typeof value.endTime === "number" &&
    (value.mode === "pomodoro" || value.mode === "deep_work" || value.mode === "custom") &&
    typeof value.blockedApp === "string" &&
    typeof value.bypassAttempts === "number"
  );
}

function clampStrictDuration(durationMs: number) {
  if (!Number.isFinite(durationMs)) return MANUAL_STRICT_DURATION_MS;
  return Math.min(MAX_STRICT_DURATION_MS, Math.max(MIN_STRICT_DURATION_MS, durationMs));
}

function sanitizeStrictSession(value: unknown): StrictModeSession | null {
  if (!isStrictModeSession(value) || !isPlausibleEventTimestamp(value.startTime)) return null;
  const durationMs = clampStrictDuration(value.endTime - value.startTime);
  const endTime = value.startTime + durationMs;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: value.id.trim() || `session_${Date.now()}`,
    startTime: value.startTime,
    endTime,
    mode: value.mode,
    blockedApp: cleanName(value.blockedApp, "Strict Mode"),
    bypassAttempts: clampInteger(value.bypassAttempts, 0, MAX_STRICT_BYPASS_ATTEMPTS, 0),
    emergencyUnlockUsedAt: isPlausibleEventTimestamp(value.emergencyUnlockUsedAt) ? value.emergencyUnlockUsedAt : null,
  };
}

function sanitizeEmergencyUnlock(value: unknown): EmergencyUnlock | null {
  if (!isRecord(value) || !isPlausibleEventTimestamp(value.unlockedAt)) return null;
  const cooldownMs = typeof value.cooldownMs === "number" && Number.isFinite(value.cooldownMs)
    ? Math.min(MAX_STRICT_DURATION_MS, Math.max(0, value.cooldownMs))
    : EMERGENCY_COOLDOWN_MS;
  return { unlockedAt: value.unlockedAt, cooldownMs };
}

function sanitizeReliability(value: unknown): StrictReliabilityState {
  if (!isRecord(value)) return { interruptionCount: 0, lastInterruptionAt: null };
  return {
    interruptionCount: clampInteger(value.interruptionCount, 0, MAX_RELIABILITY_INTERRUPTION_COUNT, 0),
    lastInterruptionAt: isPlausibleEventTimestamp(value.lastInterruptionAt) ? value.lastInterruptionAt : null,
  };
}

function sanitizeDistractionAttempt(value: unknown): DistractionAttempt | null {
  if (!isRecord(value) || !isPlausibleEventTimestamp(value.attemptedAt)) return null;
  return {
    appName: cleanName(value.appName, "Unknown app"),
    attemptedAt: value.attemptedAt,
    sessionMode: typeof value.sessionMode === "string" ? value.sessionMode.trim().slice(0, 40) || undefined : undefined,
  };
}

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const [apps, setApps] = useState<AppEntry[]>(DEFAULT_APPS);
  const [blockRules, setBlockRules] = useState<BlockRule[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>(DEFAULT_WHITELIST);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [distractionLog, setDistractionLog] = useState<DistractionAttempt[]>([]);
  const [emergencyUnlock, setEmergencyUnlock] = useState<EmergencyUnlock | null>(null);
  const [lockModeEnabled, setLockModeEnabled] = useState(false);
  const [activeSession, setActiveSession] = useState<StrictModeSession | null>(null);
  const [strictReliability, setStrictReliability] = useState<StrictReliabilityState>({ interruptionCount: 0, lastInterruptionAt: null });
  const queue = useRef(createWriteQueue());
  const appStateRef = useRef(AppState.currentState);
  const backgroundAtRef = useRef<number | null>(null);

  const strictModeEnabled = activeSession !== null;

  useEffect(() => {
    (async () => {
      try {
        const [storedApps, storedRules, storedWhitelist, storedTimetable, settings, storedDistractions, session, reliability] = await Promise.all([
          getJson<AppEntry[]>(APPS_KEY, DEFAULT_APPS, isArray as (value: unknown) => value is AppEntry[]),
          getJson<BlockRule[]>(RULES_KEY, [], isArray as (value: unknown) => value is BlockRule[]),
          getJson<WhitelistEntry[]>(WHITELIST_KEY, DEFAULT_WHITELIST, isArray as (value: unknown) => value is WhitelistEntry[]),
          getJson<TimetableSlot[]>(TIMETABLE_KEY, [], isArray as (value: unknown) => value is TimetableSlot[]),
          getJson<{ lockMode?: unknown; emergencyUnlock?: unknown }>(SETTINGS_KEY, {}, isSettings),
          getJson<DistractionAttempt[]>(DISTRACTION_KEY, [], isArray as (value: unknown) => value is DistractionAttempt[]),
          getJson<StrictModeSession | null>(STRICT_SESSION_KEY, null, (value): value is StrictModeSession | null => value === null || isStrictModeSession(value)),
          getJson<StrictReliabilityState | null>(STRICT_RELIABILITY_KEY, null, (value): value is StrictReliabilityState | null => value === null || isRecord(value)),
        ]);
        const boundedApps = storedApps.map(sanitizeAppEntry).filter((app): app is AppEntry => Boolean(app)).slice(0, MAX_APPS);
        const boundedRules = storedRules.map(sanitizeBlockRule).filter((rule): rule is BlockRule => Boolean(rule)).slice(0, MAX_BLOCK_RULES);
        const boundedWhitelist = storedWhitelist.map(sanitizeWhitelistEntry).filter((entry): entry is WhitelistEntry => Boolean(entry)).slice(0, MAX_WHITELIST);
        const boundedTimetable = storedTimetable.map(sanitizeTimetableSlot).filter((slot): slot is TimetableSlot => Boolean(slot)).slice(0, MAX_TIMETABLE_SLOTS);
        const boundedDistractions = storedDistractions.map(sanitizeDistractionAttempt).filter((attempt): attempt is DistractionAttempt => Boolean(attempt)).slice(0, MAX_LOG_ENTRIES);
        setApps(boundedApps);
        setBlockRules(boundedRules);
        setWhitelist(boundedWhitelist);
        setTimetable(boundedTimetable);
        setDistractionLog(boundedDistractions);
        await Promise.all([
          setJson(APPS_KEY, boundedApps),
          setJson(RULES_KEY, boundedRules),
          setJson(WHITELIST_KEY, boundedWhitelist),
          setJson(TIMETABLE_KEY, boundedTimetable),
          setJson(DISTRACTION_KEY, boundedDistractions),
        ]);
        if (typeof settings.lockMode === "boolean") setLockModeEnabled(settings.lockMode);
        const boundedEmergencyUnlock = sanitizeEmergencyUnlock(settings.emergencyUnlock);
        if (boundedEmergencyUnlock) setEmergencyUnlock(boundedEmergencyUnlock);
        const boundedSession = sanitizeStrictSession(session);
        if (boundedSession && boundedSession.endTime > Date.now()) {
          setActiveSession(boundedSession);
          await setJson(STRICT_SESSION_KEY, boundedSession);
        } else if (session) {
          await removeStorageItem(STRICT_SESSION_KEY);
        }
        const boundedReliability = sanitizeReliability(reliability);
        setStrictReliability(boundedReliability);
        await setJson(STRICT_RELIABILITY_KEY, boundedReliability);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    const ms = activeSession.endTime - Date.now();
    if (ms <= 0) {
      setActiveSession(null);
      queue.current.enqueue(() => removeStorageItem(STRICT_SESSION_KEY).then(() => undefined));
      return;
    }
    const t = setTimeout(() => {
      setActiveSession(null);
      queue.current.enqueue(() => removeStorageItem(STRICT_SESSION_KEY).then(() => undefined));
    }, Math.min(ms, 2_147_483_647));
    return () => clearTimeout(t);
  }, [activeSession]);

  const save = useCallback(<T,>(key: string, val: T) => {
    queue.current.enqueue(() => setJson(key, val).then(() => undefined));
  }, []);

  const persistSettings = useCallback((next: { lockMode: boolean; strictMode: boolean; emergencyUnlock: EmergencyUnlock | null }) => {
    save(SETTINGS_KEY, next);
  }, [save]);

  const persistSession = useCallback((session: StrictModeSession | null) => {
    queue.current.enqueue(async () => {
      const boundedSession = sanitizeStrictSession(session);
      if (boundedSession) await setJson(STRICT_SESSION_KEY, boundedSession);
      else await removeStorageItem(STRICT_SESSION_KEY);
    });
  }, []);

  const addApp = useCallback((app: AppEntry) => {
    const item = sanitizeAppEntry(app);
    if (!item) return;
    setApps((prev) => {
      if (prev.some((a) => a.name.toLowerCase() === item.name.toLowerCase())) return prev;
      const next = [...prev, item].slice(0, MAX_APPS);
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
      const next = prev.map((a) => a.name === name ? { ...a, blockConfig: sanitizeBlockConfig({ ...a.blockConfig, ...config }) } : a);
      save(APPS_KEY, next);
      return next;
    });
  }, [save]);

  const addBlockRule = useCallback((rule: Omit<BlockRule, "id">) => {
    const value = sanitizeRuleValue(rule.value);
    if (!value) return;
    const item = sanitizeBlockRule({ ...rule, value, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    if (!item) return;
    setBlockRules((prev) => {
      if (prev.some((r) => r.type === item.type && r.value.toLowerCase() === value.toLowerCase())) return prev;
      const next = [...prev, item].slice(0, MAX_BLOCK_RULES);
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
    const item = sanitizeWhitelistEntry(entry);
    if (!item) return;
    setWhitelist((prev) => {
      if (prev.some((w) => w.name.toLowerCase() === item.name.toLowerCase())) return prev;
      const next = [...prev, item].slice(0, MAX_WHITELIST);
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
    const item = sanitizeTimetableSlot({ ...slot, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    if (!item) return;
    setTimetable((prev) => {
      const next = [...prev.filter((existing) => !overlaps(existing, item)), item].slice(-MAX_TIMETABLE_SLOTS);
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
    const attempt = sanitizeDistractionAttempt({ appName, attemptedAt: Date.now(), sessionMode });
    if (!attempt) return;
    setDistractionLog((prev) => {
      const next = [attempt, ...prev].slice(0, MAX_LOG_ENTRIES);
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
    const safeDurationMs = clampStrictDuration(durationMs);
    const session: StrictModeSession = {
      schemaVersion: SCHEMA_VERSION,
      id: `session_${now}_${Math.random().toString(36).slice(2, 8)}`,
      startTime: now,
      endTime: now + safeDurationMs,
      mode,
      blockedApp: cleanName(blockedApp, "Strict Mode"),
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
      const updated = { ...prev, bypassAttempts: clampInteger(prev.bypassAttempts + 1, 0, MAX_STRICT_BYPASS_ATTEMPTS, 0) };
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
    queue.current.enqueue(() => removeStorageItem(DISTRACTION_KEY).then(() => undefined));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if ((nextState === "background" || nextState === "inactive") && prev === "active") {
        backgroundAtRef.current = Date.now();
        return;
      }

      if (nextState === "active" && backgroundAtRef.current && strictModeEnabled) {
        const suspendedFor = Date.now() - backgroundAtRef.current;
        backgroundAtRef.current = null;
        if (suspendedFor >= SUSPENSION_RISK_MS) {
          setStrictReliability((prevReliability) => {
            const nextReliability: StrictReliabilityState = {
              interruptionCount: prevReliability.interruptionCount + 1,
              lastInterruptionAt: Date.now(),
            };
            save(STRICT_RELIABILITY_KEY, nextReliability);
            return nextReliability;
          });
          logDistractionAttempt("System suspension risk", activeSession?.mode);
        }
      }
    });

    return () => sub.remove();
  }, [activeSession?.mode, logDistractionAttempt, save, strictModeEnabled]);

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
    blockedApps, categoryColors: CATEGORY_COLORS, disciplineScore, todayUsageByCategory, strictReliability,
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
