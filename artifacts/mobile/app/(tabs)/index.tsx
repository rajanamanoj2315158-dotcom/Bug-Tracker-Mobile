import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
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
import { SessionMode, useFocus } from "@/context/FocusContext";

const MODES: { key: SessionMode; label: string; minutes: number; desc: string }[] = [
  { key: "study", label: "Study", minutes: 25, desc: "Pomodoro · 25 min" },
  { key: "focus", label: "Focus", minutes: 45, desc: "Deep Focus · 45 min" },
  { key: "deep", label: "Deep Work", minutes: 90, desc: "Marathon · 90 min" },
];

function formatTime(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

function PulseRing({ active, color }: { active: boolean; color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      opacity.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  if (!active) return null;
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 999,
          borderWidth: 2,
          borderColor: color,
          transform: [{ scale: pulse }],
          opacity,
        },
      ]}
    />
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentSession, startSession, stopSession, pauseSession, resumeSession, todayFocusMs, streak, blockedApps } = useFocus();
  const [selectedMode, setSelectedMode] = useState<SessionMode>("study");
  const [customMinutes, setCustomMinutes] = useState(30);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const isActive = !!currentSession;
  const isPaused = currentSession?.paused ?? false;
  const progress = currentSession
    ? 1 - currentSession.remainingMs / currentSession.durationMs
    : 0;

  function handleStart() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const mode = MODES.find((m) => m.key === selectedMode)!;
    startSession(selectedMode, mode.minutes * 60 * 1000);
  }

  function handleStop() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopSession();
  }

  function handlePauseResume() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPaused) resumeSession();
    else pauseSession();
  }

  const styles = makeStyles(colors);

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={{ paddingTop: topPad + 20, paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.shieldIcon}>
          <Feather name="shield" size={18} color={colors.primary} />
        </View>
        <Text style={styles.headerTitle}>Focus Shield</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatMs(todayFocusMs)}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={[styles.statCard, styles.statCardCenter]}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{blockedApps.length}</Text>
          <Text style={styles.statLabel}>Blocked</Text>
        </View>
      </View>

      {/* Timer Circle */}
      <View style={styles.timerSection}>
        <View style={styles.timerOuter}>
          <PulseRing active={isActive && !isPaused} color={colors.primary} />
          <View style={[styles.timerCircle, isActive && styles.timerCircleActive]}>
            {isActive ? (
              <>
                <Text style={styles.timerTime}>
                  {formatTime(currentSession!.remainingMs)}
                </Text>
                <Text style={styles.timerMode}>
                  {MODES.find((m) => m.key === currentSession!.mode)?.label ?? "Session"}
                </Text>
                {isPaused && (
                  <View style={styles.pausedBadge}>
                    <Text style={styles.pausedText}>PAUSED</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Feather name="shield" size={40} color={colors.primary} />
                <Text style={styles.timerIdleText}>Ready</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Session Controls */}
      {isActive ? (
        <View style={styles.controls}>
          <Pressable
            style={({ pressed }) => [styles.controlBtn, styles.controlBtnSecondary, pressed && { opacity: 0.7 }]}
            onPress={handleStop}
          >
            <Feather name="square" size={18} color={colors.destructive} />
            <Text style={[styles.controlBtnText, { color: colors.destructive }]}>Stop</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.controlBtn, styles.controlBtnPrimary, pressed && { opacity: 0.8 }]}
            onPress={handlePauseResume}
          >
            <Feather name={isPaused ? "play" : "pause"} size={18} color={colors.primaryForeground} />
            <Text style={[styles.controlBtnText, { color: colors.primaryForeground }]}>
              {isPaused ? "Resume" : "Pause"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Mode Selection */}
          <View style={styles.modeSection}>
            <Text style={styles.sectionTitle}>Session Mode</Text>
            <View style={styles.modeGrid}>
              {MODES.map((m) => (
                <Pressable
                  key={m.key}
                  style={({ pressed }) => [
                    styles.modeCard,
                    selectedMode === m.key && styles.modeCardActive,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedMode(m.key);
                  }}
                >
                  <Text style={[styles.modeLabel, selectedMode === m.key && styles.modeLabelActive]}>
                    {m.label}
                  </Text>
                  <Text style={[styles.modeDesc, selectedMode === m.key && styles.modeDescActive]}>
                    {m.desc}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Start Button */}
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
            onPress={handleStart}
          >
            <Feather name="play" size={20} color={colors.primaryForeground} />
            <Text style={styles.startBtnText}>Start Session</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 24,
      marginBottom: 24,
    },
    shieldIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 22,
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 10,
      marginBottom: 32,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    statCardCenter: {
      borderColor: colors.primary + "55",
    },
    statValue: {
      fontFamily: "Inter_700Bold",
      fontSize: 20,
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    timerSection: {
      alignItems: "center",
      marginBottom: 40,
    },
    timerOuter: {
      width: 220,
      height: 220,
      alignItems: "center",
      justifyContent: "center",
    },
    timerCircle: {
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.border,
      gap: 4,
    },
    timerCircleActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    timerTime: {
      fontFamily: "Inter_700Bold",
      fontSize: 48,
      color: colors.foreground,
      letterSpacing: -2,
    },
    timerMode: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: colors.primary,
    },
    timerIdleText: {
      fontFamily: "Inter_500Medium",
      fontSize: 16,
      color: colors.mutedForeground,
      marginTop: 8,
    },
    pausedBadge: {
      backgroundColor: colors.warning + "22",
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 6,
    },
    pausedText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 10,
      color: colors.warning,
      letterSpacing: 1,
    },
    controls: {
      flexDirection: "row",
      paddingHorizontal: 24,
      gap: 12,
    },
    controlBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      borderRadius: colors.radius,
      borderWidth: 1,
    },
    controlBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      flex: 2,
    },
    controlBtnSecondary: {
      backgroundColor: colors.card,
      borderColor: colors.destructive + "55",
    },
    controlBtnText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
    },
    modeSection: {
      paddingHorizontal: 24,
      marginBottom: 24,
    },
    sectionTitle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.mutedForeground,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    modeGrid: {
      flexDirection: "row",
      gap: 10,
    },
    modeCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    modeCardActive: {
      backgroundColor: colors.primary + "18",
      borderColor: colors.primary,
    },
    modeLabel: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.foreground,
    },
    modeLabelActive: {
      color: colors.primary,
    },
    modeDesc: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: colors.mutedForeground,
    },
    modeDescActive: {
      color: colors.primary + "aa",
    },
    startBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginHorizontal: 24,
      paddingVertical: 18,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
    },
    startBtnText: {
      fontFamily: "Inter_700Bold",
      fontSize: 16,
      color: colors.primaryForeground,
      letterSpacing: -0.3,
    },
  });
}
