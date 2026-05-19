import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getJson, isArray, isRecord, setJson } from "@/lib/storage";

export interface Habit {
  id: string;
  name: string;
  icon: string;
  category:
    | "health"
    | "focus"
    | "learning"
    | "exercise"
    | "mindfulness"
    | "other";
  completedDates: string[];
  createdAt: number;
}

export interface DailyGoal {
  id: string;
  text: string;
  date: string;
  completed: boolean;
}

export interface Challenge {
  id: string;
  name: string;
  desc: string;
  icon: string;
  targetDays: number;
  startedAt: number;
  completedDays: string[];
  active: boolean;
}

const PREDEFINED_CHALLENGES: Omit<
  Challenge,
  "startedAt" | "completedDays" | "active"
>[] = [
  {
    id: "c1",
    name: "7-Day Focus Sprint",
    desc: "Complete at least 1 focus session every day for 7 days",
    icon: "zap",
    targetDays: 7,
  },
  {
    id: "c2",
    name: "No Social Media",
    desc: "Avoid all social media for 7 days straight",
    icon: "x-circle",
    targetDays: 7,
  },
  {
    id: "c3",
    name: "Deep Work Week",
    desc: "Complete 5 deep work sessions in a week",
    icon: "anchor",
    targetDays: 5,
  },
  {
    id: "c4",
    name: "30-Day Discipline",
    desc: "Build focus habits for 30 consecutive days",
    icon: "shield",
    targetDays: 30,
  },
  {
    id: "c5",
    name: "Morning Warrior",
    desc: "Complete a focus session before 9 AM for 5 days",
    icon: "sun",
    targetDays: 5,
  },
  {
    id: "c6",
    name: "Dopamine Reset",
    desc: "Complete 3 dopamine detox sessions",
    icon: "moon",
    targetDays: 3,
  },
];

const HABIT_TEMPLATES = [
  {
    name: "Morning meditation",
    icon: "sunrise",
    category: "mindfulness" as const,
  },
  {
    name: "Read for 30 minutes",
    icon: "book-open",
    category: "learning" as const,
  },
  {
    name: "Exercise / workout",
    icon: "activity",
    category: "exercise" as const,
  },
  {
    name: "No phone first hour",
    icon: "smartphone",
    category: "focus" as const,
  },
  { name: "Cold shower", icon: "droplet", category: "health" as const },
  { name: "Journaling", icon: "edit-3", category: "mindfulness" as const },
  { name: "Learn something new", icon: "cpu", category: "learning" as const },
  { name: "Walk / run", icon: "wind", category: "exercise" as const },
];

function getDayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface HabitContextValue {
  habits: Habit[];
  goals: DailyGoal[];
  challenges: Challenge[];
  habitTemplates: typeof HABIT_TEMPLATES;
  addHabit: (name: string, icon: string, category: Habit["category"]) => void;
  removeHabit: (id: string) => void;
  toggleHabitToday: (id: string) => void;
  addGoal: (text: string) => void;
  removeGoal: (id: string) => void;
  toggleGoal: (id: string) => void;
  startChallenge: (id: string) => void;
  markChallengeDay: (id: string) => void;
  todayHabits: { habit: Habit; completed: boolean }[];
  todayGoals: DailyGoal[];
  completedHabitsToday: number;
  completedGoalsToday: number;
}

const HabitContext = createContext<HabitContextValue | null>(null);

const HABITS_KEY = "fs_habits_v2";
const GOALS_KEY = "fs_goals_v2";
const CHALLENGES_KEY = "fs_challenges_v2";
const MAX_HABIT_NAME_LENGTH = 60;
const MAX_GOAL_TEXT_LENGTH = 120;
const MAX_DAILY_GOALS = 10;
const MAX_HABITS = 100;
const MAX_GOAL_HISTORY = 1000;
const MAX_HABIT_COMPLETION_DAYS = 730;
const MAX_CHALLENGES = 20;
const MAX_CHALLENGE_DAYS = 365;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HABIT_CATEGORIES = new Set<Habit["category"]>([
  "health",
  "focus",
  "learning",
  "exercise",
  "mindfulness",
  "other",
]);
const SAFE_ICONS = new Set([
  "activity",
  "anchor",
  "award",
  "book-open",
  "check-circle",
  "coffee",
  "cpu",
  "droplet",
  "edit-3",
  "heart",
  "moon",
  "shield",
  "smartphone",
  "star",
  "sun",
  "sunrise",
  "target",
  "wind",
  "x-circle",
  "zap",
]);

function createDefaultChallenges(): Challenge[] {
  return PREDEFINED_CHALLENGES.map((ch) => ({
    ...ch,
    startedAt: 0,
    completedDays: [],
    active: false,
  }));
}

function isHabitCategory(value: unknown): value is Habit["category"] {
  return (
    typeof value === "string" &&
    HABIT_CATEGORIES.has(value as Habit["category"])
  );
}

function sanitizeIcon(value: unknown, fallback = "check-circle") {
  return typeof value === "string" && SAFE_ICONS.has(value) ? value : fallback;
}

function sanitizeDateKeys(value: unknown, maxDays: number) {
  return [
    ...new Set(
      Array.isArray(value)
        ? value.filter(
            (date): date is string =>
              typeof date === "string" && DATE_KEY_RE.test(date),
          )
        : [],
    ),
  ].slice(-maxDays);
}

function sanitizeTimestamp(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function isStoredHabit(
  value: unknown,
): value is Record<string, unknown> & { id: string; name: string } {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}

function isStoredGoal(
  value: unknown,
): value is Record<string, unknown> & {
  id: string;
  text: string;
  date: string;
} {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.date === "string"
  );
}

function sanitizeHabits(items: unknown[]): Habit[] {
  return items
    .filter(isStoredHabit)
    .map((habit) => ({
      id: habit.id,
      name: habit.name.trim().slice(0, MAX_HABIT_NAME_LENGTH) || "Habit",
      icon: sanitizeIcon(habit.icon),
      category: isHabitCategory(habit.category) ? habit.category : "other",
      completedDates: sanitizeDateKeys(
        habit.completedDates,
        MAX_HABIT_COMPLETION_DAYS,
      ),
      createdAt: sanitizeTimestamp(habit.createdAt, Date.now()),
    }))
    .slice(0, MAX_HABITS);
}

function sanitizeGoals(items: unknown[]): DailyGoal[] {
  return items
    .filter(isStoredGoal)
    .map((goal) => ({
      id: goal.id,
      text: goal.text.trim().slice(0, MAX_GOAL_TEXT_LENGTH) || "Goal",
      date: DATE_KEY_RE.test(goal.date) ? goal.date : getDayKey(Date.now()),
      completed: goal.completed === true,
    }))
    .slice(-MAX_GOAL_HISTORY);
}

function sanitizeChallengeRecord(
  raw: unknown,
  fallback?: Challenge,
): Challenge | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  const targetDays =
    typeof raw.targetDays === "number" && Number.isInteger(raw.targetDays)
      ? Math.min(MAX_CHALLENGE_DAYS, Math.max(1, raw.targetDays))
      : (fallback?.targetDays ?? 7);
  const completedDays = sanitizeDateKeys(raw.completedDays, targetDays).slice(
    0,
    targetDays,
  );
  const active = raw.active === true && completedDays.length < targetDays;

  return {
    id: raw.id,
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_GOAL_TEXT_LENGTH)
        : (fallback?.name ?? "Focus Challenge"),
    desc:
      typeof raw.desc === "string" && raw.desc.trim()
        ? raw.desc.trim().slice(0, 180)
        : (fallback?.desc ??
          "Complete the challenge to build focus consistency"),
    icon: sanitizeIcon(raw.icon, fallback?.icon ?? "target"),
    targetDays,
    startedAt: sanitizeTimestamp(
      raw.startedAt,
      active ? Date.now() : (fallback?.startedAt ?? 0),
    ),
    completedDays,
    active,
  };
}

function sanitizeChallenges(items: unknown[]): Challenge[] {
  const defaults = createDefaultChallenges();
  const byId = new Map(
    items.filter(isRecord).map((item) => [item.id, item] as const),
  );
  const sanitizedDefaults = defaults.map(
    (challenge) =>
      sanitizeChallengeRecord(byId.get(challenge.id) ?? challenge, challenge) ??
      challenge,
  );
  const extraChallenges = items
    .filter(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        !defaults.some((challenge) => challenge.id === item.id),
    )
    .map((item) => sanitizeChallengeRecord(item))
    .filter((challenge): challenge is Challenge => Boolean(challenge));

  return [...sanitizedDefaults, ...extraChallenges].slice(0, MAX_CHALLENGES);
}

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const defaults = createDefaultChallenges();
        const [storedHabits, storedGoals, storedChallenges] = await Promise.all(
          [
            getJson<Habit[]>(
              HABITS_KEY,
              [],
              isArray as (value: unknown) => value is Habit[],
            ),
            getJson<DailyGoal[]>(
              GOALS_KEY,
              [],
              isArray as (value: unknown) => value is DailyGoal[],
            ),
            getJson<Challenge[]>(
              CHALLENGES_KEY,
              defaults,
              isArray as (value: unknown) => value is Challenge[],
            ),
          ],
        );
        const boundedHabits = sanitizeHabits(storedHabits);
        const boundedGoals = sanitizeGoals(storedGoals);
        const boundedChallenges = sanitizeChallenges(storedChallenges);
        setHabits(boundedHabits);
        setGoals(boundedGoals);
        setChallenges(boundedChallenges);
        await setJson(HABITS_KEY, boundedHabits);
        await setJson(GOALS_KEY, boundedGoals);
        await setJson(CHALLENGES_KEY, boundedChallenges);
      } catch {}
    })();
  }, []);

  const saveHabits = useCallback(async (h: Habit[]) => {
    await setJson(HABITS_KEY, sanitizeHabits(h));
  }, []);
  const saveGoals = useCallback(async (g: DailyGoal[]) => {
    await setJson(GOALS_KEY, sanitizeGoals(g));
  }, []);
  const saveChallenges = useCallback(async (c: Challenge[]) => {
    await setJson(CHALLENGES_KEY, sanitizeChallenges(c));
  }, []);

  const addHabit = useCallback(
    (name: string, icon: string, category: Habit["category"]) => {
      const safeName = name.trim().slice(0, MAX_HABIT_NAME_LENGTH);
      if (!safeName) return;
      const habit: Habit = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: safeName,
        icon,
        category,
        completedDates: [],
        createdAt: Date.now(),
      };
      setHabits((prev) => {
        if (prev.some((h) => h.name.toLowerCase() === safeName.toLowerCase()))
          return prev;
        const next = sanitizeHabits([...prev, habit]);
        saveHabits(next);
        return next;
      });
    },
    [saveHabits],
  );

  const removeHabit = useCallback(
    (id: string) => {
      setHabits((prev) => {
        const next = prev.filter((h) => h.id !== id);
        saveHabits(next);
        return next;
      });
    },
    [saveHabits],
  );

  const toggleHabitToday = useCallback(
    (id: string) => {
      const today = getDayKey(Date.now());
      setHabits((prev) => {
        const next = prev.map((h) => {
          if (h.id !== id) return h;
          const done = h.completedDates.includes(today);
          return {
            ...h,
            completedDates: done
              ? h.completedDates.filter((d) => d !== today)
              : [...h.completedDates, today].slice(-MAX_HABIT_COMPLETION_DAYS),
          };
        });
        saveHabits(next);
        return next;
      });
    },
    [saveHabits],
  );

  const addGoal = useCallback(
    (text: string) => {
      const safeText = text.trim().slice(0, MAX_GOAL_TEXT_LENGTH);
      if (!safeText) return;
      const today = getDayKey(Date.now());
      const goal: DailyGoal = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: safeText,
        date: today,
        completed: false,
      };
      setGoals((prev) => {
        const todayGoalCount = prev.filter((g) => g.date === today).length;
        if (todayGoalCount >= MAX_DAILY_GOALS) return prev;
        const next = sanitizeGoals([...prev, goal]);
        saveGoals(next);
        return next;
      });
    },
    [saveGoals],
  );

  const removeGoal = useCallback(
    (id: string) => {
      setGoals((prev) => {
        const next = prev.filter((g) => g.id !== id);
        saveGoals(next);
        return next;
      });
    },
    [saveGoals],
  );

  const toggleGoal = useCallback(
    (id: string) => {
      setGoals((prev) => {
        const next = prev.map((g) =>
          g.id === id ? { ...g, completed: !g.completed } : g,
        );
        saveGoals(next);
        return next;
      });
    },
    [saveGoals],
  );

  const startChallenge = useCallback(
    (id: string) => {
      setChallenges((prev) => {
        const next = prev.map((c) =>
          c.id === id && !c.active
            ? { ...c, active: true, startedAt: Date.now(), completedDays: [] }
            : c,
        );
        saveChallenges(next);
        return next;
      });
    },
    [saveChallenges],
  );

  const markChallengeDay = useCallback(
    (id: string) => {
      const today = getDayKey(Date.now());
      setChallenges((prev) => {
        const next = prev.map((c) => {
          if (c.id !== id || !c.active || c.completedDays.includes(today))
            return c;
          if (c.completedDays.length >= c.targetDays)
            return { ...c, active: false };
          const completedDays = [...c.completedDays, today].slice(
            0,
            c.targetDays,
          );
          return {
            ...c,
            completedDays,
            active: completedDays.length < c.targetDays,
          };
        });
        saveChallenges(next);
        return next;
      });
    },
    [saveChallenges],
  );

  const today = getDayKey(Date.now());
  const todayHabits = habits.map((h) => ({
    habit: h,
    completed: h.completedDates.includes(today),
  }));
  const todayGoals = goals.filter((g) => g.date === today);
  const completedHabitsToday = todayHabits.filter((h) => h.completed).length;
  const completedGoalsToday = todayGoals.filter((g) => g.completed).length;

  return (
    <HabitContext.Provider
      value={{
        habits,
        goals,
        challenges,
        habitTemplates: HABIT_TEMPLATES,
        addHabit,
        removeHabit,
        toggleHabitToday,
        addGoal,
        removeGoal,
        toggleGoal,
        startChallenge,
        markChallengeDay,
        todayHabits,
        todayGoals,
        completedHabitsToday,
        completedGoalsToday,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}

export function useHabits() {
  const ctx = useContext(HabitContext);
  if (!ctx) throw new Error("useHabits must be used within HabitProvider");
  return ctx;
}
