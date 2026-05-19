import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { Habit, useHabits } from "@/context/HabitContext";
import { useFocus } from "@/context/FocusContext";
import { TimetableSlot, useUsage } from "@/context/UsageContext";

type Tab = "habits" | "goals" | "challenges" | "timetable";

const ICON_OPTIONS = [
  "sunrise",
  "book-open",
  "activity",
  "smartphone",
  "droplet",
  "edit-3",
  "cpu",
  "wind",
  "moon",
  "zap",
  "coffee",
  "heart",
  "award",
  "check-circle",
  "target",
  "star",
];

const CATEGORY_META: Record<
  Habit["category"],
  { label: string; color: string }
> = {
  health: { label: "Health", color: "#22c55e" },
  focus: { label: "Focus", color: "#38bdf8" },
  learning: { label: "Learning", color: "#f59e0b" },
  exercise: { label: "Exercise", color: "#f97316" },
  mindfulness: { label: "Mindfulness", color: "#8b5cf6" },
  other: { label: "Other", color: "#64748b" },
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMETABLE_PRESETS = [
  {
    label: "Morning Focus",
    type: "focus" as const,
    startTime: "09:00",
    endTime: "12:00",
    days: [1, 2, 3, 4, 5],
  },
  {
    label: "Afternoon Work",
    type: "study" as const,
    startTime: "14:00",
    endTime: "17:00",
    days: [1, 2, 3, 4, 5],
  },
  {
    label: "Evening Wind Down",
    type: "break" as const,
    startTime: "20:00",
    endTime: "21:00",
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    label: "Sleep Zone",
    type: "sleep" as const,
    startTime: "23:00",
    endTime: "07:00",
    days: [0, 1, 2, 3, 4, 5, 6],
  },
];

const TYPE_COLORS: Record<string, string> = {
  focus: "#38bdf8",
  study: "#f59e0b",
  break: "#22c55e",
  sleep: "#8b5cf6",
  exercise: "#f97316",
  free: "#64748b",
};

function getLocalDayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sortTimetable(a: TimetableSlot, b: TimetableSlot) {
  if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
  return a.startTime.localeCompare(b.startTime);
}

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    todayHabits,
    habits,
    goals,
    challenges,
    addHabit,
    removeHabit,
    toggleHabitToday,
    addGoal,
    removeGoal,
    toggleGoal,
    startChallenge,
    markChallengeDay,
    habitTemplates,
    completedHabitsToday,
    completedGoalsToday,
    todayGoals,
  } = useHabits();
  const { streak, productivityScore } = useFocus();
  const { timetable, addTimetableSlot, removeTimetableSlot } = useUsage();

  const [activeTab, setActiveTab] = useState<Tab>("habits");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [habitIcon, setHabitIcon] = useState("sunrise");
  const [habitCat, setHabitCat] = useState<Habit["category"]>("focus");
  const [goalInput, setGoalInput] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const today = getLocalDayKey(Date.now());
  const styles = makeStyles(colors);

  function handleAddHabit() {
    if (!habitName.trim()) return;
    addHabit(habitName.trim(), habitIcon, habitCat);
    setHabitName("");
    setShowAddHabit(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleAddGoal() {
    if (!goalInput.trim()) return;
    addGoal(goalInput.trim());
    setGoalInput("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function addPresetToTimetable(preset: (typeof TIMETABLE_PRESETS)[number]) {
    preset.days.forEach((dayOfWeek) => {
      addTimetableSlot({
        dayOfWeek,
        startTime: preset.startTime,
        endTime: preset.endTime,
        label: preset.label,
        type: preset.type,
      });
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function addTodayFocusBlock() {
    addTimetableSlot({
      dayOfWeek: new Date().getDay(),
      startTime: "09:00",
      endTime: "10:00",
      label: "Focus Block",
      type: "focus",
    });
    Haptics.selectionAsync();
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.headerTitle}>More</Text>
        <View style={styles.scoreBadge}>
          <Feather name="bar-chart-2" size={12} color={colors.primary} />
          <Text style={styles.scoreBadgeText}>{productivityScore} score</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["habits", "goals", "challenges", "timetable"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(t);
            }}
          >
            <Text
              style={[styles.tabText, activeTab === t && styles.tabTextActive]}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
      >
        {/* HABITS TAB */}
        {activeTab === "habits" && (
          <View style={styles.tabContent}>
            {/* Summary */}
            <View style={styles.habitSummaryRow}>
              <View style={styles.habitSummaryCard}>
                <Text style={styles.habitSummaryValue}>
                  {completedHabitsToday}/{habits.length}
                </Text>
                <Text style={styles.habitSummaryLabel}>Done Today</Text>
              </View>
              <View style={styles.habitSummaryCard}>
                <Text style={styles.habitSummaryValue}>{streak}</Text>
                <Text style={styles.habitSummaryLabel}>Day Streak</Text>
              </View>
              <View style={styles.habitSummaryCard}>
                <Text
                  style={[styles.habitSummaryValue, { color: colors.success }]}
                >
                  {habits.length > 0
                    ? Math.round((completedHabitsToday / habits.length) * 100)
                    : 0}
                  %
                </Text>
                <Text style={styles.habitSummaryLabel}>Rate</Text>
              </View>
            </View>

            {/* Today's habits */}
            {todayHabits.length === 0 ? (
              <View style={styles.empty}>
                <Feather
                  name="check-square"
                  size={28}
                  color={colors.mutedForeground}
                />
                <Text style={styles.emptyTitle}>No habits yet</Text>
                <Text style={styles.emptySub}>
                  Add habits below to track them daily
                </Text>
              </View>
            ) : (
              todayHabits.map(({ habit, completed }) => {
                const meta =
                  CATEGORY_META[habit.category] ?? CATEGORY_META.other;
                return (
                  <Pressable
                    key={habit.id}
                    style={({ pressed }) => [
                      styles.habitRow,
                      completed && styles.habitRowDone,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      toggleHabitToday(habit.id);
                    }}
                    onLongPress={() => {
                      Alert.alert("Remove Habit", `Remove "${habit.name}"?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => removeHabit(habit.id),
                        },
                      ]);
                    }}
                  >
                    <View
                      style={[
                        styles.habitCheck,
                        completed && styles.habitCheckDone,
                      ]}
                    >
                      {completed && (
                        <Feather name="check" size={13} color="#fff" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.habitName,
                          completed && styles.habitNameDone,
                        ]}
                      >
                        {habit.name}
                      </Text>
                      <Text style={[styles.habitCat, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.habitIconBg,
                        { backgroundColor: meta.color + "22" },
                      ]}
                    >
                      <Feather
                        name={habit.icon as any}
                        size={15}
                        color={meta.color}
                      />
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Add from templates */}
            {!showAddHabit && (
              <>
                <Text style={styles.subsectionTitle}>Quick Add</Text>
                <View style={styles.templateGrid}>
                  {habitTemplates
                    .filter((t) => !habits.some((h) => h.name === t.name))
                    .slice(0, 6)
                    .map((t) => (
                      <Pressable
                        key={t.name}
                        style={({ pressed }) => [
                          styles.templateChip,
                          pressed && { opacity: 0.75 },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          addHabit(t.name, t.icon, t.category);
                        }}
                      >
                        <Feather
                          name={t.icon as any}
                          size={13}
                          color={colors.primary}
                        />
                        <Text style={styles.templateChipText}>{t.name}</Text>
                      </Pressable>
                    ))}
                </View>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => setShowAddHabit(true)}
                >
                  <Feather name="plus" size={16} color={colors.primary} />
                  <Text style={styles.addBtnText}>Create Custom Habit</Text>
                </Pressable>
              </>
            )}

            {/* Custom habit form */}
            {showAddHabit && (
              <View style={styles.addHabitForm}>
                <Text style={styles.subsectionTitle}>New Habit</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Habit name..."
                  placeholderTextColor={colors.mutedForeground}
                  value={habitName}
                  onChangeText={setHabitName}
                />
                <Text style={styles.subsectionTitle}>Icon</Text>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map((icon) => (
                    <Pressable
                      key={icon}
                      style={[
                        styles.iconOption,
                        habitIcon === icon && styles.iconOptionActive,
                      ]}
                      onPress={() => setHabitIcon(icon)}
                    >
                      <Feather
                        name={icon as any}
                        size={16}
                        color={
                          habitIcon === icon
                            ? colors.primary
                            : colors.mutedForeground
                        }
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.subsectionTitle}>Category</Text>
                <View style={styles.catGrid}>
                  {(
                    Object.entries(CATEGORY_META) as [
                      Habit["category"],
                      { label: string; color: string },
                    ][]
                  ).map(([key, meta]) => (
                    <Pressable
                      key={key}
                      style={[
                        styles.catOption,
                        habitCat === key && {
                          borderColor: meta.color,
                          backgroundColor: meta.color + "18",
                        },
                      ]}
                      onPress={() => setHabitCat(key)}
                    >
                      <Text
                        style={[
                          styles.catOptionText,
                          habitCat === key && { color: meta.color },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.formBtns}>
                  <Pressable
                    style={styles.formBtnCancel}
                    onPress={() => setShowAddHabit(false)}
                  >
                    <Text style={styles.formBtnCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.formBtnSave}
                    onPress={handleAddHabit}
                  >
                    <Text style={styles.formBtnSaveText}>Save Habit</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {/* GOALS TAB */}
        {activeTab === "goals" && (
          <View style={styles.tabContent}>
            <View style={styles.goalsSummary}>
              <Text style={styles.goalsSummaryText}>
                {completedGoalsToday}/{todayGoals.length} goals completed today
              </Text>
              {todayGoals.length > 0 && (
                <View style={styles.goalsProgressBg}>
                  <View
                    style={[
                      styles.goalsProgressFill,
                      {
                        width:
                          todayGoals.length > 0
                            ? `${(completedGoalsToday / todayGoals.length) * 100}%`
                            : "0%",
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            <View style={styles.addGoalRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add a goal for today..."
                placeholderTextColor={colors.mutedForeground}
                value={goalInput}
                onChangeText={setGoalInput}
                onSubmitEditing={handleAddGoal}
                returnKeyType="done"
              />
              <Pressable style={styles.addGoalBtn} onPress={handleAddGoal}>
                <Feather
                  name="plus"
                  size={18}
                  color={colors.primaryForeground}
                />
              </Pressable>
            </View>

            {todayGoals.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="flag" size={28} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No goals today</Text>
                <Text style={styles.emptySub}>
                  Set your 3 most important goals for the day
                </Text>
              </View>
            ) : (
              todayGoals.map((goal) => (
                <Pressable
                  key={goal.id}
                  style={({ pressed }) => [
                    styles.goalRow,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    toggleGoal(goal.id);
                  }}
                  onLongPress={() => {
                    Alert.alert("Remove Goal", `Remove "${goal.text}"?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () => removeGoal(goal.id),
                      },
                    ]);
                  }}
                >
                  <View
                    style={[
                      styles.goalCheck,
                      goal.completed && styles.goalCheckDone,
                    ]}
                  >
                    {goal.completed && (
                      <Feather name="check" size={12} color="#fff" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.goalText,
                      goal.completed && styles.goalTextDone,
                    ]}
                  >
                    {goal.text}
                  </Text>
                </Pressable>
              ))
            )}

            <View style={styles.infoBox}>
              <Feather name="info" size={13} color={colors.primary} />
              <Text style={styles.infoBoxText}>
                Goals reset daily. Focus on 1-3 high-impact goals for best
                results.
              </Text>
            </View>
          </View>
        )}

        {/* CHALLENGES TAB */}
        {activeTab === "challenges" && (
          <View style={styles.tabContent}>
            {challenges.map((ch) => {
              const progress = ch.completedDays.length;
              const pct = Math.min(1, progress / ch.targetDays);
              return (
                <View
                  key={ch.id}
                  style={[
                    styles.challengeCard,
                    ch.active && styles.challengeCardActive,
                  ]}
                >
                  <View style={styles.challengeTop}>
                    <View
                      style={[
                        styles.challengeIcon,
                        ch.active && { backgroundColor: colors.primary + "22" },
                      ]}
                    >
                      <Feather
                        name={ch.icon as any}
                        size={20}
                        color={
                          ch.active ? colors.primary : colors.mutedForeground
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.challengeName}>{ch.name}</Text>
                      <Text style={styles.challengeDesc}>{ch.desc}</Text>
                    </View>
                    <View
                      style={[
                        styles.challengeProgress,
                        ch.active && { borderColor: colors.primary + "55" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.challengeProgressText,
                          ch.active && { color: colors.primary },
                        ]}
                      >
                        {progress}/{ch.targetDays}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.challengeProgressBg}>
                    <View
                      style={[
                        styles.challengeProgressFill,
                        {
                          width: `${pct * 100}%`,
                          backgroundColor: ch.active
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.challengeActions}>
                    {!ch.active ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.challengeStartBtn,
                          pressed && { opacity: 0.75 },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Medium,
                          );
                          startChallenge(ch.id);
                        }}
                      >
                        <Text style={styles.challengeStartBtnText}>
                          Start Challenge
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={({ pressed }) => [
                          styles.challengeMarkBtn,
                          pressed && { opacity: 0.75 },
                          ch.completedDays.includes(today) &&
                            styles.challengeMarkBtnDone,
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          markChallengeDay(ch.id);
                        }}
                        disabled={ch.completedDays.includes(today)}
                      >
                        <Feather
                          name={
                            ch.completedDays.includes(today) ? "check" : "plus"
                          }
                          size={14}
                          color={
                            ch.completedDays.includes(today)
                              ? colors.success
                              : colors.primary
                          }
                        />
                        <Text
                          style={[
                            styles.challengeMarkBtnText,
                            ch.completedDays.includes(today) && {
                              color: colors.success,
                            },
                          ]}
                        >
                          {ch.completedDays.includes(today)
                            ? "Done for today"
                            : "Mark today complete"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* TIMETABLE TAB */}
        {activeTab === "timetable" && (
          <View style={styles.tabContent}>
            <View style={styles.infoBox}>
              <Feather name="calendar" size={13} color={colors.primary} />
              <Text style={styles.infoBoxText}>
                Build a structured daily schedule. Focus Shield will
                auto-activate blocking during focus blocks.
              </Text>
            </View>
            <Text style={styles.subsectionTitle}>Schedule Templates</Text>
            {TIMETABLE_PRESETS.map((preset, i) => {
              const color = TYPE_COLORS[preset.type] ?? colors.primary;
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.timetableCard,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => addPresetToTimetable(preset)}
                >
                  <View
                    style={[styles.timetableBar, { backgroundColor: color }]}
                  />
                  <View
                    style={[
                      styles.timetableIcon,
                      { backgroundColor: color + "20" },
                    ]}
                  >
                    <Feather
                      name={
                        preset.type === "sleep"
                          ? "moon"
                          : preset.type === "focus"
                            ? "target"
                            : preset.type === "study"
                              ? "book-open"
                              : "coffee"
                      }
                      size={16}
                      color={color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timetableLabel}>{preset.label}</Text>
                    <Text style={styles.timetableTime}>
                      {preset.startTime} – {preset.endTime}
                    </Text>
                    <Text style={styles.timetableDays}>
                      {preset.days.length === 7
                        ? "Every day"
                        : preset.days.map((d) => DAY_NAMES[d]).join(", ")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: color + "22" },
                    ]}
                  >
                    <Text style={[styles.typeBadgeText, { color }]}>
                      {preset.type}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <Text style={styles.subsectionTitle}>Active Schedule</Text>
            {timetable.length === 0 ? (
              <View style={styles.empty}>
                <Feather
                  name="calendar"
                  size={28}
                  color={colors.mutedForeground}
                />
                <Text style={styles.emptyTitle}>No time blocks yet</Text>
                <Text style={styles.emptySub}>
                  Tap a template or add a focus block for today
                </Text>
              </View>
            ) : (
              [...timetable].sort(sortTimetable).map((slot) => {
                const color = TYPE_COLORS[slot.type] ?? colors.primary;
                return (
                  <Pressable
                    key={slot.id}
                    style={({ pressed }) => [
                      styles.timetableCard,
                      pressed && { opacity: 0.75 },
                    ]}
                    onLongPress={() => {
                      Alert.alert(
                        "Remove Time Block",
                        `Remove "${slot.label}"?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () => removeTimetableSlot(slot.id),
                          },
                        ],
                      );
                    }}
                  >
                    <View
                      style={[styles.timetableBar, { backgroundColor: color }]}
                    />
                    <View
                      style={[
                        styles.timetableIcon,
                        { backgroundColor: color + "20" },
                      ]}
                    >
                      <Feather
                        name={
                          slot.type === "sleep"
                            ? "moon"
                            : slot.type === "focus"
                              ? "target"
                              : slot.type === "study"
                                ? "book-open"
                                : "clock"
                        }
                        size={16}
                        color={color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timetableLabel}>{slot.label}</Text>
                      <Text style={styles.timetableTime}>
                        {DAY_NAMES[slot.dayOfWeek]} · {slot.startTime} –{" "}
                        {slot.endTime}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: color + "22" },
                      ]}
                    >
                      <Text style={[styles.typeBadgeText, { color }]}>
                        {slot.type}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}

            <Pressable style={styles.addBtn} onPress={addTodayFocusBlock}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.addBtnText}>Add Today Focus Block</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 24,
      color: c.foreground,
      letterSpacing: -0.6,
    },
    scoreBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: c.primary + "20",
      borderRadius: 99,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: c.primary + "44",
    },
    scoreBadgeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 12,
      color: c.primary,
    },
    tabs: {
      flexDirection: "row",
      marginHorizontal: 20,
      marginBottom: 8,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
    tabActive: { backgroundColor: c.primary },
    tabText: {
      fontFamily: "Inter_500Medium",
      fontSize: 11,
      color: c.mutedForeground,
    },
    tabTextActive: {
      color: c.primaryForeground,
      fontFamily: "Inter_600SemiBold",
    },
    tabContent: { paddingHorizontal: 20, gap: 10 },
    habitSummaryRow: { flexDirection: "row", gap: 10 },
    habitSummaryCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
    },
    habitSummaryValue: {
      fontFamily: "Inter_700Bold",
      fontSize: 20,
      color: c.foreground,
      letterSpacing: -0.5,
    },
    habitSummaryLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: c.mutedForeground,
      marginTop: 2,
    },
    empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
    emptyTitle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
      color: c.foreground,
    },
    emptySub: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: c.mutedForeground,
      textAlign: "center",
      maxWidth: 260,
      lineHeight: 20,
    },
    habitRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    habitRowDone: { opacity: 0.65 },
    habitCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    habitCheckDone: { backgroundColor: c.success, borderColor: c.success },
    habitName: {
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      color: c.foreground,
    },
    habitNameDone: {
      textDecorationLine: "line-through",
      color: c.mutedForeground,
    },
    habitCat: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
    habitIconBg: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    subsectionTitle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 11,
      color: c.mutedForeground,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    templateChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.card,
      borderRadius: 99,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: c.border,
    },
    templateChipText: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: c.foreground,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.primary + "44",
      borderStyle: "dashed",
    },
    addBtnText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: c.primary,
    },
    addHabitForm: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      gap: 12,
    },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      color: c.foreground,
    },
    iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    iconOption: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    iconOptionActive: {
      borderColor: c.primary,
      backgroundColor: c.primary + "18",
    },
    catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    catOption: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 99,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    catOptionText: {
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      color: c.mutedForeground,
    },
    formBtns: { flexDirection: "row", gap: 10 },
    formBtnCancel: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
    },
    formBtnCancelText: {
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      color: c.mutedForeground,
    },
    formBtnSave: {
      flex: 2,
      padding: 12,
      borderRadius: 10,
      backgroundColor: c.primary,
      alignItems: "center",
    },
    formBtnSaveText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: c.primaryForeground,
    },
    goalsSummary: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
    },
    goalsSummaryText: {
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      color: c.foreground,
    },
    goalsProgressBg: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      overflow: "hidden",
    },
    goalsProgressFill: {
      height: 4,
      backgroundColor: c.success,
      borderRadius: 2,
    },
    addGoalRow: { flexDirection: "row", gap: 10 },
    addGoalBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      width: 46,
      alignItems: "center",
      justifyContent: "center",
    },
    goalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    goalCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    goalCheckDone: { backgroundColor: c.success, borderColor: c.success },
    goalText: {
      flex: 1,
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      color: c.foreground,
    },
    goalTextDone: {
      textDecorationLine: "line-through",
      color: c.mutedForeground,
    },
    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    infoBoxText: {
      flex: 1,
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: c.mutedForeground,
      lineHeight: 18,
    },
    challengeCard: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      gap: 12,
    },
    challengeCardActive: {
      borderColor: c.primary + "55",
      backgroundColor: c.primary + "08",
    },
    challengeTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    challengeIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    challengeName: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
      color: c.foreground,
    },
    challengeDesc: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: c.mutedForeground,
      marginTop: 3,
      lineHeight: 17,
    },
    challengeProgress: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    challengeProgressText: {
      fontFamily: "Inter_700Bold",
      fontSize: 12,
      color: c.mutedForeground,
    },
    challengeProgressBg: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      overflow: "hidden",
    },
    challengeProgressFill: { height: 4, borderRadius: 2 },
    challengeActions: { alignItems: "flex-start" },
    challengeStartBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    challengeStartBtnText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: c.primaryForeground,
    },
    challengeMarkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: c.primary + "55",
      backgroundColor: c.primary + "14",
    },
    challengeMarkBtnDone: {
      borderColor: c.success + "55",
      backgroundColor: c.success + "14",
    },
    challengeMarkBtnText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: c.primary,
    },
    timetableCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
      paddingRight: 12,
    },
    timetableBar: { width: 4, alignSelf: "stretch" },
    timetableIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 12,
      marginLeft: 8,
    },
    timetableLabel: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: c.foreground,
    },
    timetableTime: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: c.mutedForeground,
      marginTop: 2,
    },
    timetableDays: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: c.mutedForeground,
      marginTop: 1,
    },
    typeBadge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
    typeBadgeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 10,
      textTransform: "capitalize",
    },
  });
}
