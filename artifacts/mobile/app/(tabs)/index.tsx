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
  "Deep work is the superpower of the 21st century.",
  "The successful warrior is the average man with laser-like focus.",
  "It's not about having time. It's about making time.",
];

function formatMs(ms: number) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const h = Math.floor(safe / 3600000);
  const m = Math.floor((safe % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

function clampPercent(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

// ─── Animated Score Ring ──────────────────────────────────────────────────────

function ScoreRing({ score, size = 130, strokeWidth = 10 }: { score: number; size?: number; strokeWidth?: number }) {
  const colors = useColors();
  const breathAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scoreAnim, { toValue: clampPercent(score), duration: 1200, useNativeDriver: false }).start();
  }, [score]);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 3500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const getColor = (s: number) => {
    if (s >= 80) return colors.success;
    if (s >= 50) return colors.primary;
    if (s >= 25) return colors.warning;
    return colors.destructive;
  };
  const safeScore = clampPercent(score);
  const ringColor = getColor(safeScore);

  const ringScale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ringOpacity = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] });

  const progress = safeScore / 100;
  const STROKE = strokeWidth;

  return (
    <View style={{ width: size + 24, height: size + 24, alignItems: "center", justifyContent: "center" }}>
      {/* Outer glow ring */}
      <Animated.View style={{
        position: "absolute",
        width: size + 24, height: size + 24,
        borderRadius: (size + 24) / 2,
        borderWidth: 1, borderColor: ringColor,
        transform: [{ scale: ringScale }],
        opacity: ringOpacity,
      }} />

      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {/* Track */}
        <View style={{
          position: "absolute", inset: 0, borderRadius: size / 2,
          borderWidth: STROKE, borderColor: "#142840",
        }} />

        {/* Progress arc */}
        {Platform.OS === "web" ? (
          <>
            <View style={{
              position: "absolute", inset: 0, borderRadius: size / 2,
              // @ts-ignore
              background: `conic-gradient(from -90deg, ${ringColor}88 ${Math.round(progress * 360)}deg, transparent ${Math.round(progress * 360)}deg)`,
            }} />
            <View style={{
              position: "absolute", inset: STROKE,
              borderRadius: (size - STROKE * 2) / 2,
              backgroundColor: "#010f1f",
            }} />
          </>
        ) : (
          <View style={{
            position: "absolute", inset: 0, borderRadius: size / 2,
            borderWidth: STROKE, borderColor: "transparent", borderTopColor: ringColor,
            transform: [{ rotate: `${progress * 360 - 90}deg` }],
          }} />
        )}

        {/* Center */}
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 30, color: ringColor, letterSpacing: -1 }}>{safeScore}</Text>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.mutedForeground, letterSpacing: 0.5 }}>SCORE</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Pulsing Live Dot ─────────────────────────────────────────────────────────

function LiveDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute",
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: color + "44",
        transform: [{ scale: pulse }],
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const MODE_QUICK = [
  { key: "pomodoro" as const, label: "Pomodoro", icon: "clock", color: "#f59e0b", desc: "25 min cycles" },
  { key: "deep" as const, label: "Deep Work", icon: "anchor", color: "#6366f1", desc: "90 min focus" },
  { key: "monk" as const, label: "Monk Mode", icon: "moon", color: "#8b5cf6", desc: "3h silence" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { productivityScore, streak, todayFocusMs, currentSession, level, achievements, startSession, weekFocusMs } = useFocus();
  const { completedHabitsToday, todayHabits, toggleHabitToday } = useHabits();
  const { blockedApps, disciplineScore } = useUsage();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const quote = QUOTES[new Date().getDay() % QUOTES.length];
  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const activeColor = currentSession?.customColor
    ?? ({ pomodoro: "#f59e0b", study: "#38bdf8", deep: "#6366f1", monk: "#8b5cf6", detox: "#ec4899", founder: "#f97316", custom: "#38bdf8" }[currentSession?.mode ?? "custom"] ?? "#38bdf8");

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
          <Feather name="shield" size={11} color={colors.primary} />
          <Text style={styles.levelText}>LV{level}</Text>
        </View>
      </View>

      {/* Active Session Banner */}
      {currentSession && (
        <Pressable
          style={({ pressed }) => [styles.activeBanner, { borderColor: activeColor + "55", backgroundColor: activeColor + "0C" }, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/focus")}
        >
          <LiveDot color={activeColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.activeBannerTitle, { color: activeColor }]}>
              {currentSession.customPresetName ?? "Focus Session"} {currentSession.paused ? "· PAUSED" : ""}
            </Text>
            <Text style={styles.activeBannerSub}>
              {Math.ceil((Number.isFinite(currentSession.remainingMs) ? Math.max(0, currentSession.remainingMs) : 0) / 60000)}m remaining · tap to open timer
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={activeColor} />
        </Pressable>
      )}

      {/* Score + Stats */}
      <View style={styles.scoreSection}>
        <ScoreRing score={productivityScore} size={130} strokeWidth={10} />
        <View style={styles.scoreSide}>
          <View style={styles.statRow}>
            <Feather name="zap" size={13} color={colors.warning} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </View>
          <View style={styles.statRow}>
            <Feather name="clock" size={13} color={colors.primary} />
            <Text style={styles.statValue}>{formatMs(todayFocusMs)}</Text>
            <Text style={styles.statLabel}>today</Text>
          </View>
          <View style={styles.statRow}>
            <Feather name="trending-up" size={13} color={colors.neonGreen} />
            <Text style={styles.statValue}>{formatMs(weekFocusMs)}</Text>
            <Text style={styles.statLabel}>this week</Text>
          </View>
          <View style={styles.statRow}>
            <Feather name="shield" size={13} color={colors.success} />
            <Text style={styles.statValue}>{blockedApps.length}</Text>
            <Text style={styles.statLabel}>apps blocked</Text>
          </View>
          <View style={styles.statRow}>
            <Feather name="award" size={13} color={colors.accent} />
            <Text style={styles.statValue}>{unlockedCount}/{achievements.length}</Text>
            <Text style={styles.statLabel}>achievements</Text>
          </View>
        </View>
      </View>

      {/* Discipline score bar */}
      <View style={styles.disciplineCard}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={styles.disciplineLabel}>Discipline Score</Text>
          <Text style={[styles.disciplineValue, { color: disciplineScore >= 70 ? colors.success : disciplineScore >= 40 ? colors.warning : colors.destructive }]}>
            {disciplineScore}/100 · {disciplineScore >= 80 ? "Excellent" : disciplineScore >= 60 ? "Good" : disciplineScore >= 40 ? "Building" : "Focus!"}
          </Text>
        </View>
        <View style={styles.disciplineTrack}>
          <View style={[styles.disciplineFill, {
            width: `${clampPercent(disciplineScore)}%` as any,
            backgroundColor: disciplineScore >= 70 ? colors.success : disciplineScore >= 40 ? colors.warning : colors.destructive,
          }]} />
        </View>
      </View>

      {/* Quick Launch */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Launch</Text>
        <View style={styles.modeRow}>
          {MODE_QUICK.map((m) => (
            <Pressable
              key={m.key}
              style={({ pressed }) => [styles.modeCard, pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                startSession(m.key);
                router.push("/focus");
              }}
            >
              <View style={[styles.modeCardIcon, { backgroundColor: m.color + "22" }]}>
                <Feather name={m.icon as any} size={18} color={m.color} />
              </View>
              <Text style={styles.modeCardLabel}>{m.label}</Text>
              <Text style={styles.modeCardDesc}>{m.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Today's Habits */}
      {todayHabits.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today's Habits</Text>
            <Text style={[styles.sectionCount, completedHabitsToday === todayHabits.length && { color: colors.success }]}>
              {completedHabitsToday}/{todayHabits.length}
            </Text>
          </View>
          <View style={styles.card}>
            {todayHabits.slice(0, 4).map(({ habit, completed }, idx) => (
              <React.Fragment key={habit.id}>
                {idx > 0 && <View style={styles.rowDivider} />}
                <Pressable
                  style={({ pressed }) => [styles.habitRow, pressed && { opacity: 0.7 }]}
                  onPress={() => { Haptics.selectionAsync(); toggleHabitToday(habit.id); }}
                >
                  <View style={[styles.habitCheck, completed && { backgroundColor: colors.success, borderColor: colors.success }]}>
                    {completed && <Feather name="check" size={11} color="#fff" />}
                  </View>
                  <Text style={[styles.habitName, completed && { color: colors.mutedForeground, textDecorationLine: "line-through" }]}>
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
        <Feather name="message-circle" size={14} color={colors.primary} />
        <Text style={styles.quoteText}>"{quote}"</Text>
      </View>

      {/* Achievements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {achievements.slice(0, 10).map((a) => (
            <View key={a.id} style={[styles.achievementCard, !a.unlockedAt && { opacity: 0.4 }]}>
              <View style={[styles.achievementIcon, { backgroundColor: a.unlockedAt ? colors.primary + "22" : colors.border }]}>
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
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: c.foreground, letterSpacing: -0.7 },
    levelBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.primary + "18", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: c.glassBorder },
    levelText: { fontFamily: "Inter_700Bold", fontSize: 13, color: c.primary },
    activeBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 16, borderRadius: 14, padding: 14, borderWidth: 1 },
    activeBannerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
    activeBannerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 1 },
    scoreSection: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, gap: 20, marginBottom: 16 },
    scoreSide: { flex: 1, gap: 9 },
    statRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    statValue: { fontFamily: "Inter_700Bold", fontSize: 14, color: c.foreground },
    statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground },
    disciplineCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.glassBorder },
    disciplineLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
    disciplineValue: { fontFamily: "Inter_700Bold", fontSize: 13 },
    disciplineTrack: { height: 5, backgroundColor: c.border, borderRadius: 3, overflow: "hidden" },
    disciplineFill: { height: 5, borderRadius: 3 },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: c.mutedForeground, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 },
    sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    sectionCount: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.primary },
    modeRow: { flexDirection: "row", gap: 10 },
    modeCard: { flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.glassBorder, gap: 5 },
    modeCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    modeCardLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.foreground },
    modeCardDesc: { fontFamily: "Inter_400Regular", fontSize: 10, color: c.mutedForeground },
    card: { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.glassBorder, overflow: "hidden" },
    habitRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    habitCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    habitName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    rowDivider: { height: 1, backgroundColor: c.border, marginLeft: 50 },
    quoteCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 20, marginBottom: 20, backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.glassBorder, borderLeftWidth: 3, borderLeftColor: c.primary },
    quoteText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, lineHeight: 20, fontStyle: "italic" },
    achievementCard: { width: 88, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.glassBorder, alignItems: "center", gap: 7 },
    achievementIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    achievementTitle: { fontFamily: "Inter_500Medium", fontSize: 10, color: c.foreground, textAlign: "center", lineHeight: 14 },
  });
}
