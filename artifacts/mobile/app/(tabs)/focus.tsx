import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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

const MODES: {
  key: SessionMode;
  label: string;
  icon: string;
  color: string;
  duration: string;
  desc: string;
  tag: string;
}[] = [
  { key: "pomodoro", label: "Pomodoro", icon: "clock", color: "#f59e0b", duration: "25 + 5 min", desc: "Classic 25/5 cycles. Auto-switches between work and break phases.", tag: "POPULAR" },
  { key: "study", label: "Study Mode", icon: "book-open", color: "#38bdf8", duration: "45 min", desc: "Extended study block. Great for coursework and reading.", tag: "" },
  { key: "deep", label: "Deep Work", icon: "anchor", color: "#6366f1", duration: "90 min", desc: "Uninterrupted deep focus. For complex tasks that need full brainpower.", tag: "ELITE" },
  { key: "detox", label: "Dopamine Detox", icon: "x-circle", color: "#ec4899", duration: "120 min", desc: "Break the dopamine loop. No shortcuts, no distractions allowed.", tag: "" },
  { key: "monk", label: "Monk Mode", icon: "moon", color: "#8b5cf6", duration: "3 hours", desc: "Total silence and focus. Used by peak performers and CEOs.", tag: "HARDCORE" },
  { key: "founder", label: "Founder Mode", icon: "briefcase", color: "#f97316", duration: "4 hours", desc: "Marathon deep work. For when ordinary focus is not enough.", tag: "EXTREME" },
];

const AMBIENT_SOUNDS = [
  { key: "none", label: "No Sound", icon: "volume-x" },
  { key: "rain", label: "Rain", icon: "cloud-rain" },
  { key: "fire", label: "Fireplace", icon: "wind" },
  { key: "white", label: "White Noise", icon: "radio" },
  { key: "forest", label: "Forest", icon: "feather" },
  { key: "cafe", label: "Café", icon: "coffee" },
  { key: "ocean", label: "Ocean", icon: "droplet" },
  { key: "thunder", label: "Thunder", icon: "zap" },
];

function formatTime(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

export default function FocusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    currentSession, startSession, stopSession, pauseSession, resumeSession,
    skipPomodoroBreak, todaySessions, totalFocusMs, streak
  } = useFocus();
  const [selectedMode, setSelectedMode] = useState<SessionMode>("pomodoro");
  const [selectedAmbient, setSelectedAmbient] = useState("none");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isActive = !!currentSession;
  const isPaused = currentSession?.paused ?? false;
  const isPomodoro = currentSession?.mode === "pomodoro";
  const ps = currentSession?.pomodoroState;

  const progressPct = currentSession
    ? 1 - currentSession.remainingMs / currentSession.durationMs
    : 0;

  const phaseLabelMap: Record<string, string> = {
    work: "Work",
    short_break: "Short Break",
    long_break: "Long Break",
  };

  const activeModeInfo = MODES.find((m) => m.key === currentSession?.mode);
  const styles = makeStyles(colors);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Focus</Text>
        <View style={styles.streakBadge}>
          <Feather name="zap" size={12} color={colors.warning} />
          <Text style={styles.streakText}>{streak} day streak</Text>
        </View>
      </View>

      {/* Timer */}
      <View style={styles.timerCard}>
        {isActive ? (
          <>
            {/* Phase badge for pomodoro */}
            {isPomodoro && ps && (
              <View style={styles.phaseBadgeRow}>
                <View style={[styles.phaseBadge, { backgroundColor: ps.phase === "work" ? colors.primary + "22" : colors.success + "22" }]}>
                  <Text style={[styles.phaseBadgeText, { color: ps.phase === "work" ? colors.primary : colors.success }]}>
                    {phaseLabelMap[ps.phase]} · Cycle {Math.ceil(ps.completedCycles / 2) + (ps.phase === "work" ? 0 : 0) || 1}
                  </Text>
                </View>
                {/* Cycle dots */}
                <View style={styles.cycleDots}>
                  {[1, 2, 3, 4].map((n) => (
                    <View
                      key={n}
                      style={[styles.cycleDot, n <= ps.completedCycles % 4 && styles.cycleDotDone]}
                    />
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.timerTime}>
              {formatTime(currentSession!.remainingMs)}
            </Text>
            <Text style={styles.timerModeLabel}>
              {activeModeInfo?.label ?? currentSession!.mode}
              {isPaused ? " · PAUSED" : ""}
            </Text>

            {/* Progress bar */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <Pressable
                style={({ pressed }) => [styles.controlBtnSm, pressed && { opacity: 0.7 }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); stopSession(); }}
              >
                <Feather name="square" size={16} color={colors.destructive} />
                <Text style={[styles.controlBtnSmText, { color: colors.destructive }]}>Stop</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.controlBtnLg, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  isPaused ? resumeSession() : pauseSession();
                }}
              >
                <Feather name={isPaused ? "play" : "pause"} size={20} color={colors.primaryForeground} />
                <Text style={styles.controlBtnLgText}>{isPaused ? "Resume" : "Pause"}</Text>
              </Pressable>

              {isPomodoro && ps?.phase !== "work" && (
                <Pressable
                  style={({ pressed }) => [styles.controlBtnSm, pressed && { opacity: 0.7 }]}
                  onPress={() => { Haptics.selectionAsync(); skipPomodoroBreak(); }}
                >
                  <Feather name="skip-forward" size={16} color={colors.primary} />
                  <Text style={[styles.controlBtnSmText, { color: colors.primary }]}>Skip</Text>
                </Pressable>
              )}
              {!(isPomodoro && ps?.phase !== "work") && (
                <View style={styles.controlBtnSm} />
              )}
            </View>
          </>
        ) : (
          <>
            <View style={styles.timerIdleIconWrap}>
              <Feather name="target" size={36} color={colors.primary} />
            </View>
            <Text style={styles.timerIdleTitle}>Ready to Focus</Text>
            <Text style={styles.timerIdleSub}>Select a mode below and start your session</Text>
            <View style={styles.idleStatsRow}>
              <View style={styles.idleStat}>
                <Text style={styles.idleStatValue}>{todaySessions.filter((s) => s.completed).length}</Text>
                <Text style={styles.idleStatLabel}>Today</Text>
              </View>
              <View style={[styles.idleStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }]}>
                <Text style={styles.idleStatValue}>{formatMs(totalFocusMs)}</Text>
                <Text style={styles.idleStatLabel}>All Time</Text>
              </View>
              <View style={styles.idleStat}>
                <Text style={styles.idleStatValue}>{streak}</Text>
                <Text style={styles.idleStatLabel}>Streak</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Mode Selection */}
      {!isActive && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Mode</Text>
            <View style={styles.modeList}>
              {MODES.map((m) => (
                <Pressable
                  key={m.key}
                  style={({ pressed }) => [
                    styles.modeCard,
                    selectedMode === m.key && { borderColor: m.color, backgroundColor: m.color + "12" },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedMode(m.key); }}
                >
                  <View style={[styles.modeIconWrap, { backgroundColor: m.color + "20" }]}>
                    <Feather name={m.icon as any} size={20} color={m.color} />
                  </View>
                  <View style={styles.modeInfo}>
                    <View style={styles.modeTitleRow}>
                      <Text style={[styles.modeName, selectedMode === m.key && { color: m.color }]}>
                        {m.label}
                      </Text>
                      {m.tag ? (
                        <View style={[styles.modeTag, { backgroundColor: m.color + "22" }]}>
                          <Text style={[styles.modeTagText, { color: m.color }]}>{m.tag}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.modeDuration}>{m.duration}</Text>
                    <Text style={styles.modeDesc} numberOfLines={2}>{m.desc}</Text>
                  </View>
                  {selectedMode === m.key && (
                    <Feather name="check-circle" size={18} color={m.color} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Ambient Sounds */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ambient Sound</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {AMBIENT_SOUNDS.map((s) => (
                <Pressable
                  key={s.key}
                  style={({ pressed }) => [
                    styles.ambientChip,
                    selectedAmbient === s.key && styles.ambientChipActive,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedAmbient(s.key); }}
                >
                  <Feather name={s.icon as any} size={14} color={selectedAmbient === s.key ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.ambientLabel, selectedAmbient === s.key && { color: colors.primary }]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {selectedAmbient !== "none" && (
              <View style={styles.ambientNote}>
                <Feather name="info" size={12} color={colors.mutedForeground} />
                <Text style={styles.ambientNoteText}>Audio plays via system media after enabling in device settings</Text>
              </View>
            )}
          </View>

          {/* Start Button */}
          <Pressable
            style={({ pressed }) => [styles.startBtn, { backgroundColor: MODES.find((m) => m.key === selectedMode)?.color ?? colors.primary }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              startSession(selectedMode);
            }}
          >
            <Feather name="play" size={20} color="#fff" />
            <Text style={styles.startBtnText}>Start {MODES.find((m) => m.key === selectedMode)?.label}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 16 },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: c.foreground, letterSpacing: -0.6 },
    streakBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.warning + "20", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: c.warning + "44" },
    streakText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.warning },
    timerCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: c.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: c.border, alignItems: "center", gap: 12 },
    phaseBadgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10 },
    phaseBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    phaseBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, letterSpacing: 0.2 },
    cycleDots: { flexDirection: "row", gap: 6 },
    cycleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border },
    cycleDotDone: { backgroundColor: c.primary },
    timerTime: { fontFamily: "Inter_700Bold", fontSize: 64, color: c.foreground, letterSpacing: -3 },
    timerModeLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: c.mutedForeground },
    progressBg: { width: "100%", height: 4, backgroundColor: c.border, borderRadius: 2, overflow: "hidden" },
    progressFill: { height: 4, backgroundColor: c.primary, borderRadius: 2 },
    controls: { flexDirection: "row", width: "100%", gap: 10, alignItems: "center", marginTop: 4 },
    controlBtnSm: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    controlBtnSmText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
    controlBtnLg: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: c.primary },
    controlBtnLgText: { fontFamily: "Inter_700Bold", fontSize: 15, color: c.primaryForeground },
    timerIdleIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.primary + "18", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.primary + "44" },
    timerIdleTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: c.foreground },
    timerIdleSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center" },
    idleStatsRow: { flexDirection: "row", width: "100%", marginTop: 4 },
    idleStat: { flex: 1, alignItems: "center", paddingVertical: 8 },
    idleStatValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: c.foreground, letterSpacing: -0.5 },
    idleStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 2 },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.mutedForeground, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 12 },
    modeList: { gap: 10 },
    modeCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border },
    modeIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    modeInfo: { flex: 1, gap: 3 },
    modeTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    modeName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground },
    modeTag: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    modeTagText: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.5 },
    modeDuration: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
    modeDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, lineHeight: 17 },
    ambientChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.card, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.border },
    ambientChipActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    ambientLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground },
    ambientNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10, opacity: 0.7 },
    ambientNoteText: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, flex: 1, lineHeight: 16 },
    startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 20, paddingVertical: 18, borderRadius: 16, marginBottom: 10 },
    startBtnText: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#fff", letterSpacing: -0.3 },
  });
}
