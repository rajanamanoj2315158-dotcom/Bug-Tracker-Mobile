import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getJson, isArray, setJson } from "@/lib/storage";

export interface Habit {
  id: string;
  name: string;
  icon: string;
  category: "health" | "focus" | "learning" | "exercise" | "mindfulness" | "other";
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

const PREDEFINED_CHALLENGES: Omit<Challenge, "startedAt" | "completedDays" | "active">[] = [
  { id: "c1", name: "7-Day Focus Sprint", desc: "Complete at least 1 focus session every day for 7 days", icon: "zap", targetDays: 7 },
  { id: "c2", name: "No Social Media", desc: "Avoid all social media for 7 days straight", icon: "x-circle", targetDays: 7 },
  { id: "c3", name: "Deep Work Week", desc: "Complete 5 deep work sessions in a week", icon: "anchor", targetDays: 5 },
  { id: "c4", name: "30-Day Discipline", desc: "Build focus habits for 30 consecutive days", icon: "shield", targetDays: 30 },
  { id: "c5", name: "Morning Warrior", desc: "Complete a focus session before 9 AM for 5 days", icon: "sun", targetDays: 5 },
  { id: "c6", name: "Dopamine Reset", desc: "Complete 3 dopamine detox sessions", icon: "moon", targetDays: 3 },
];

const HABIT_TEMPLATES = [
  { name: "Morning meditation", icon: "sunrise", category: "mindfulness" as const },
  { name: "Read for 30 minutes", icon: "book-open", category: "learning" as const },
  { name: "Exercise / workout", icon: "activity", category: "exercise" as const },
  { name: "No phone first hour", icon: "smartphone", category: "focus" as const },
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

function createDefaultChallenges(): Challenge[] {
  return PREDEFINED_CHALLENGES.map((ch) => ({
    ...ch,
    startedAt: 0,
    completedDays: [],
    active: false,
  }));
}

export function HabitProvider({ children }: { children: React.ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const defaults = createDefaultChallenges();
        const [storedHabits, storedGoals, storedChallenges] = await Promise.all([
          getJson<Habit[]>(HABITS_KEY, [], isArray as (value: unknown) => value is Habit[]),
          getJson<DailyGoal[]>(GOALS_KEY, [], isArray as (value: unknown) => value is DailyGoal[]),
          getJson<Challenge[]>(CHALLENGES_KEY, defaults, isArray as (value: unknown) => value is Challenge[]),
        ]);
        setHabits(storedHabits);
        setGoals(storedGoals);
        setChallenges(storedChallenges);
        if (storedChallenges.length === defaults.length && storedChallenges.every((challenge) => challenge.startedAt === 0 && !challenge.active)) {
          await setJson(CHALLENGES_KEY, storedChallenges);
        }
      } catch {}
    })();
  }, []);

  const saveHabits = useCallback(async (h: Habit[]) => {
    await setJson(HABITS_KEY, h);
  }, []);
  const saveGoals = useCallback(async (g: DailyGoal[]) => {
    await setJson(GOALS_KEY, g);
  }, []);
  const saveChallenges = useCallback(async (c: Challenge[]) => {
    await setJson(CHALLENGES_KEY, c);
  }, []);

  const addHabit = useCallback((name: string, icon: string, category: Habit["category"]) => {
    const habit: Habit = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name, icon, category,
      completedDates: [],
      createdAt: Date.now(),
    };
    setHabits((prev) => {
      const next = [...prev, habit];
      saveHabits(next);
      return next;
    });
  }, [saveHabits]);

  const removeHabit = useCallback((id: string) => {
    setHabits((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHabits(next);
      return next;
    });
  }, [saveHabits]);

  const toggleHabitToday = useCallback((id: string) => {
    const today = getDayKey(Date.now());
    setHabits((prev) => {
      const next = prev.map((h) => {
        if (h.id !== id) return h;
        const done = h.completedDates.includes(today);
        return {
          ...h,
          completedDates: done
            ? h.completedDates.filter((d) => d !== today)
            : [...h.completedDates, today],
        };
      });
      saveHabits(next);
      return next;
    });
  }, [saveHabits]);

  const addGoal = useCallback((text: string) => {
    const goal: DailyGoal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      date: getDayKey(Date.now()),
      completed: false,
    };
    setGoals((prev) => {
      const next = [...prev, goal];
      saveGoals(next);
      return next;
    });
  }, [saveGoals]);

  const removeGoal = useCallback((id: string) => {
    setGoals((prev) => {
      const next = prev.filter((g) => g.id !== id);
      saveGoals(next);
      return next;
    });
  }, [saveGoals]);

  const toggleGoal = useCallback((id: string) => {
    setGoals((prev) => {
      const next = prev.map((g) => g.id === id ? { ...g, completed: !g.completed } : g);
      saveGoals(next);
      return next;
    });
  }, [saveGoals]);

  const startChallenge = useCallback((id: string) => {
    setChallenges((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, active: true, startedAt: Date.now(), completedDays: [] } : c
      );
      saveChallenges(next);
      return next;
    });
  }, [saveChallenges]);

  const markChallengeDay = useCallback((id: string) => {
    const today = getDayKey(Date.now());
    setChallenges((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id || c.completedDays.includes(today)) return c;
        return { ...c, completedDays: [...c.completedDays, today] };
      });
      saveChallenges(next);
      return next;
    });
  }, [saveChallenges]);

  const today = getDayKey(Date.now());
  const todayHabits = habits.map((h) => ({ habit: h, completed: h.completedDates.includes(today) }));
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
