import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFocus } from "@/context/FocusContext";
import { useHabits } from "@/context/HabitContext";
import { useUsage } from "@/context/UsageContext";

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "Discipline is the bridge between goals and accomplishment.",
  "Focus on being productive instead of busy.",
  "Small disciplines repeated with consistency lead to great achievements.",
  "Your future is created by what you do today, not tomorrow.",
  "The successful warrior is the average man with laser-like focus.",
  "It's not about having time. It's about making time.",
  "Deep work is the superpower of the 21st century.",
];

function formatMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const colors = useColors();
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: score,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const getColor = (s: number) => {
    if (s >= 80) return colors.success;
    if (s >= 50) return colors.primary;
    if (s >= 25) return colors.warning;
    return colors.destructive;
  };

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: colors.border,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size - strokeWidth * 2,
          height: (size - strokeWidth * 2) * (score / 100),
          bottom: strokeWidth,
          borderRadius: size / 2,
          backgroundColor: getColor(score) + "18",
          overflow: "hidden",
        }}
      />
      <View style={{ alignItems: "center" }}>
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 32,
            color: getColor(score),
            letterSpacing: -1,
          }}
        >
          {score}
        </Text>
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground }}>
          SCORE
        </Text>
      </View>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: "transparent",
          borderTopColor: getColor(score),
          transform: [{ rotate: `${(score / 100) * 360 - 90}deg` }],
        }}
      />
    </View>
  );
}

const MODE_INFO = {
  pomodoro: { label: "Pomodoro", icon: "clock", color: "#f59e0b", desc: "25 min work cycles" },
  deep: { label: "Deep Work", icon: "anchor", color: "#6366f1", desc: "90 min deep focus" },
  monk: { label: "Monk Mode", icon: "moon", color: "#8b5cf6", desc: "3h total silence" },
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { productivityScore, streak, todayFocusMs, currentSession, level, achievements, startSession } = useFocus();
  const { completedHabitsToday, todayHabits, toggleHabitToday } = useHabits();
  const { blockedApps } = useUsage();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const quote = QUOTES[new Date().getDay() % QUOTES.length];
  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const styles = makeStyles(colors);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.headerTitle}>Focus Shield</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>LV{level}</Text>
        </View>
      </View>

      {/* Active Session Banner */}
      {currentSession && (
        <Pressable
          style={({ pressed }) => [styles.activeBanner, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/focus")}
        >
          <View style={styles.activeDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>Session in Progress</Text>
            <Text style={styles.activeBannerSub}>
              {currentSession.paused ? "Paused · " : ""}
              {Math.ceil(currentSession.remainingMs / 60000)}m remaining
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.primary} />
        </Pressable>
      )}

      {/* Score + Stats */}
      <View style={styles.scoreSection}>
        <ScoreRing score={productivityScore} size={130} strokeWidth={10} />
        <View style={styles.scoreSide}>
          <View style={styles.scoreStatRow}>
            <Feather name="zap" size={14} color={colors.warning} />
            <Text style={styles.scoreStatValue}>{streak}</Text>
            <Text style={styles.scoreStatLabel}>day streak</Text>
          </View>
          <View style={styles.scoreStatRow}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={styles.scoreStatValue}>{formatMs(todayFocusMs)}</Text>
            <Text style={styles.scoreStatLabel}>focused today</Text>
          </View>
          <View style={styles.scoreStatRow}>
            <Feather name="shield" size={14} color={colors.success} />
            <Text style={styles.scoreStatValue}>{blockedApps.length}</Text>
            <Text style={styles.scoreStatLabel}>apps blocked</Text>
          </View>
          <View style={styles.scoreStatRow}>
            <Feather name="award" size={14} color={colors.accent} />
            <Text style={styles.scoreStatValue}>{unlockedCount}</Text>
            <Text style={styles.scoreStatLabel}>achievements</Text>
          </View>
        </View>
      </View>

      {/* Quick Launch */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Launch</Text>
        <View style={styles.modeRow}>
          {(Object.entries(MODE_INFO) as [keyof typeof MODE_INFO, typeof MODE_INFO[keyof typeof MODE_INFO]][]).map(([key, info]) => (
            <Pressable
              key={key}
              style={({ pressed }) => [styles.modeQuickCard, pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                startSession(key);
                router.push("/focus");
              }}
            >
              <View style={[styles.modeQuickIcon, { backgroundColor: info.color + "22" }]}>
                <Feather name={info.icon as any} size={18} color={info.color} />
              </View>
              <Text style={styles.modeQuickLabel}>{info.label}</Text>
              <Text style={styles.modeQuickDesc}>{info.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Today's Habits */}
      {todayHabits.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today's Habits</Text>
            <Text style={styles.sectionCount}>
              {completedHabitsToday}/{todayHabits.length}
            </Text>
          </View>
          <View style={styles.card}>
            {todayHabits.slice(0, 4).map(({ habit, completed }, idx) => (
              <React.Fragment key={habit.id}>
                {idx > 0 && <View style={styles.rowDivider} />}
                <Pressable
                  style={({ pressed }) => [styles.habitRow, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    toggleHabitToday(habit.id);
                  }}
                >
                  <View style={[styles.habitCheck, completed && styles.habitCheckDone]}>
                    {completed && <Feather name="check" size={12} color={colors.primaryForeground} />}
                  </View>
                  <Text style={[styles.habitName, completed && styles.habitNameDone]}>
                    {habit.name}
                  </Text>
                  <Feather name={habit.icon as any} size={14} color={completed ? colors.success : colors.mutedForeground} />
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* Quote */}
      <View style={styles.quoteCard}>
        <Feather name="message-circle" size={14} color={colors.primary} style={{ marginBottom: 6 }} />
        <Text style={styles.quoteText}>"{quote}"</Text>
      </View>

      {/* Achievements preview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 0 }}>
          {achievements.slice(0, 8).map((a) => (
            <View key={a.id} style={[styles.achievementCard, !a.unlockedAt && styles.achievementCardLocked]}>
              <View style={[styles.achievementIcon, a.unlockedAt ? styles.achievementIconUnlocked : styles.achievementIconLocked]}>
                <Feather name={a.icon as any} size={18} color={a.unlockedAt ? colors.primary : colors.mutedForeground} />
              </View>
              <Text style={[styles.achievementTitle, !a.unlockedAt && { color: colors.mutedForeground }]} numberOfLines={2}>
                {a.title}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 16 },
    greeting: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginBottom: 2 },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: c.foreground, letterSpacing: -0.6 },
    levelBadge: { backgroundColor: c.primary + "22", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: c.primary + "55" },
    levelText: { fontFamily: "Inter_700Bold", fontSize: 13, color: c.primary },
    activeBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginBottom: 16, backgroundColor: c.primary + "18", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.primary + "44" },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
    activeBannerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground },
    activeBannerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 1 },
    scoreSection: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, gap: 24, marginBottom: 28 },
    scoreSide: { flex: 1, gap: 12 },
    scoreStatRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    scoreStatValue: { fontFamily: "Inter_700Bold", fontSize: 15, color: c.foreground },
    scoreStatLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.mutedForeground, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 },
    sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    sectionCount: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.primary },
    modeRow: { flexDirection: "row", gap: 10 },
    modeQuickCard: { flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border, gap: 6 },
    modeQuickIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    modeQuickLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground },
    modeQuickDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground },
    card: { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
    habitRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    habitCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    habitCheckDone: { backgroundColor: c.success, borderColor: c.success },
    habitName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    habitNameDone: { color: c.mutedForeground, textDecorationLine: "line-through" },
    rowDivider: { height: 1, backgroundColor: c.border, marginLeft: 50 },
    quoteCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border, borderLeftWidth: 3, borderLeftColor: c.primary },
    quoteText: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, lineHeight: 20, fontStyle: "italic" },
    achievementCard: { width: 90, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border, alignItems: "center", gap: 8 },
    achievementCardLocked: { opacity: 0.5 },
    achievementIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    achievementIconUnlocked: { backgroundColor: c.primary + "22" },
    achievementIconLocked: { backgroundColor: c.border },
    achievementTitle: { fontFamily: "Inter_500Medium", fontSize: 11, color: c.foreground, textAlign: "center", lineHeight: 14 },
  });
}
