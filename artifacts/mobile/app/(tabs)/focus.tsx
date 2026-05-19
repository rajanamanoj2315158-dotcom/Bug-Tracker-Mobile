import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { CustomPreset, SessionMode, TimerMode, useFocus } from "@/context/FocusContext";

// ─── Constants ───────────────────────────────────────────────────────────────

const MODES: {
  key: SessionMode;
  label: string;
  icon: string;
  color: string;
  duration: string;
  desc: string;
  tag: string;
}[] = [
  { key: "pomodoro", label: "Pomodoro", icon: "clock", color: "#f59e0b", duration: "25 + 5 min", desc: "Classic 25/5 cycles with auto phase switching.", tag: "POPULAR" },
  { key: "study", label: "Study Mode", icon: "book-open", color: "#38bdf8", duration: "45 min", desc: "Extended deep study block for coursework.", tag: "" },
  { key: "deep", label: "Deep Work", icon: "anchor", color: "#6366f1", duration: "90 min", desc: "Uninterrupted flow for complex problem solving.", tag: "ELITE" },
  { key: "detox", label: "Dopamine Detox", icon: "x-circle", color: "#ec4899", duration: "120 min", desc: "Break the loop. No shortcuts.", tag: "" },
  { key: "monk", label: "Monk Mode", icon: "moon", color: "#8b5cf6", duration: "3 hours", desc: "Total silence. Used by peak performers.", tag: "HARDCORE" },
  { key: "founder", label: "Founder Mode", icon: "briefcase", color: "#f97316", duration: "4 hours", desc: "Marathon deep work session.", tag: "EXTREME" },
];

const AMBIENT_SOUNDS = [
  { key: "none", label: "Silent", icon: "volume-x" },
  { key: "rain", label: "Rain", icon: "cloud-rain" },
  { key: "fire", label: "Fire", icon: "wind" },
  { key: "white", label: "White", icon: "radio" },
  { key: "forest", label: "Forest", icon: "feather" },
  { key: "cafe", label: "Café", icon: "coffee" },
  { key: "ocean", label: "Ocean", icon: "droplet" },
  { key: "binaural", label: "Binaural", icon: "headphones" },
];

const PRESET_COLORS = ["#38bdf8", "#6366f1", "#ec4899", "#f59e0b", "#22c55e", "#ef4444", "#f97316", "#8b5cf6"];
const PRESET_ICONS = ["book-open", "code", "briefcase", "anchor", "moon", "zap", "target", "cpu", "coffee", "music", "pen-tool", "globe"];
const DURATION_OPTIONS = [15, 20, 25, 30, 45, 60, 90, 120, 150, 180, 240, 360, 480];
const BREAK_OPTIONS = [0, 5, 10, 15, 20, 25, 30];
const TIMER_MODES: { key: TimerMode; label: string; icon: string; desc: string }[] = [
  { key: "countdown", label: "Countdown", icon: "clock", desc: "Fixed duration, counts down" },
  { key: "pomodoro", label: "Pomodoro", icon: "repeat", desc: "Work/break cycles" },
  { key: "stopwatch", label: "Stopwatch", icon: "watch", desc: "Count up, no limit" },
  { key: "interval", label: "Interval", icon: "activity", desc: "Alternating focus/rest" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(ms: number, isStopwatch = false) {
  const total = isStopwatch ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
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

function formatMinutes(m: number) {
  if (m === 0) return "No break";
  if (m < 60) return `${m}m`;
  return `${m / 60}h`;
}

// ─── BreathOrbTimer ───────────────────────────────────────────────────────────

function BreathOrbTimer({
  size,
  progress,
  color,
  isActive,
  children,
}: {
  size: number;
  progress: number;
  color: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  const breathAnim = useRef(new Animated.Value(0)).current;
  const STROKE = 10;
  const ring1 = size + 48;
  const ring2 = size + 24;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const r1Scale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const r1Opacity = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, isActive ? 0.28 : 0.1] });
  const r2Scale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const r2Opacity = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, isActive ? 0.42 : 0.15] });
  const innerGlow = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.03, isActive ? 0.16 : 0.06] });

  return (
    <View style={{ width: ring1, height: ring1, alignItems: "center", justifyContent: "center" }}>
      {/* Outer glow ring */}
      <Animated.View
        style={{
          position: "absolute",
          width: ring1, height: ring1,
          borderRadius: ring1 / 2,
          borderWidth: 1, borderColor: color,
          transform: [{ scale: r1Scale }],
          opacity: r1Opacity,
        }}
      />
      {/* Mid glow ring */}
      <Animated.View
        style={{
          position: "absolute",
          width: ring2, height: ring2,
          borderRadius: ring2 / 2,
          borderWidth: 1.5, borderColor: color,
          transform: [{ scale: r2Scale }],
          opacity: r2Opacity,
        }}
      />

      {/* Main circle */}
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {/* Track */}
        <View
          style={{
            position: "absolute", inset: 0, borderRadius: size / 2,
            borderWidth: STROKE, borderColor: "#142840",
          }}
        />

        {/* Progress arc */}
        {Platform.OS === "web" ? (
          <>
            <View
              style={{
                position: "absolute", inset: 0, borderRadius: size / 2,
                // @ts-ignore — web-only conic-gradient
                background: `conic-gradient(from -90deg, ${color}99 ${Math.round(progress * 360)}deg, transparent ${Math.round(progress * 360)}deg)`,
              }}
            />
            <View
              style={{
                position: "absolute", inset: STROKE,
                borderRadius: (size - STROKE * 2) / 2,
                backgroundColor: "#010f1f",
              }}
            />
          </>
        ) : (
          <>
            {/* Right half */}
            <View style={{ position: "absolute", top: 0, right: 0, width: size / 2, height: size, overflow: "hidden" }}>
              <View
                style={{
                  position: "absolute", left: -(size / 2), top: 0,
                  width: size, height: size, borderRadius: size / 2,
                  borderWidth: STROKE, borderColor: "transparent",
                  borderTopColor: color + "99", borderRightColor: color + "99",
                  transform: [{ rotate: `${Math.min(progress, 0.5) * 360 + 180}deg` }],
                }}
              />
            </View>
            {/* Left half */}
            {progress > 0.5 && (
              <View style={{ position: "absolute", top: 0, left: 0, width: size / 2, height: size, overflow: "hidden" }}>
                <View
                  style={{
                    position: "absolute", right: -(size / 2), top: 0,
                    width: size, height: size, borderRadius: size / 2,
                    borderWidth: STROKE, borderColor: "transparent",
                    borderTopColor: color + "99", borderLeftColor: color + "99",
                    transform: [{ rotate: `${(progress - 0.5) * 360}deg` }],
                  }}
                />
              </View>
            )}
            {/* Indicator dot */}
            <View
              style={{
                position: "absolute", inset: 0, borderRadius: size / 2,
                borderWidth: STROKE, borderColor: "transparent", borderTopColor: color,
                transform: [{ rotate: `${progress * 360 - 90}deg` }],
              }}
            />
          </>
        )}

        {/* Inner glow */}
        <Animated.View
          style={{
            position: "absolute", inset: STROKE + 4,
            borderRadius: (size - (STROKE + 4) * 2) / 2,
            backgroundColor: color, opacity: innerGlow,
          }}
        />

        {/* Center content */}
        <View style={{ alignItems: "center", zIndex: 1 }}>{children}</View>
      </View>
    </View>
  );
}

// ─── Custom Preset Creator ────────────────────────────────────────────────────

function PresetCreator({
  onSave,
  onCancel,
}: {
  onSave: (preset: Omit<CustomPreset, "id">) => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const [name, setName] = useState("My Focus Timer");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [durationMin, setDurationMin] = useState(45);
  const [breakMin, setBreakMin] = useState(10);
  const [timerMode, setTimerMode] = useState<TimerMode>("countdown");
  const [strict, setStrict] = useState(false);
  const [autoRepeat, setAutoRepeat] = useState(false);
  const [sound, setSound] = useState("none");

  const needsBreak = timerMode === "pomodoro" || timerMode === "interval";

  const s = StyleSheet.create({
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.glassBorder, padding: 16, gap: 14 },
    label: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
    input: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, fontFamily: "Inter_500Medium", fontSize: 15, color: colors.foreground },
    colorRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
    iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    iconBtn: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    chipRow: { flexDirection: "row", gap: 7 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    chipActive: {},
    chipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground },
    modeBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", gap: 4 },
    modeBtnActive: {},
    modeBtnText: { fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground },
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    toggleLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: colors.foreground },
    toggleSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
    divider: { height: 1, backgroundColor: colors.border },
    actions: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    saveBtn: { flex: 2, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  });

  return (
    <View style={s.card}>
      {/* Name */}
      <View>
        <Text style={s.label}>Session Name</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Deep Work Marathon"
          placeholderTextColor={colors.mutedForeground}
          maxLength={32}
        />
      </View>

      {/* Color */}
      <View>
        <Text style={s.label}>Color</Text>
        <View style={s.colorRow}>
          {PRESET_COLORS.map((c) => (
            <Pressable
              key={c}
              style={[s.colorDot, { backgroundColor: c }, color === c && { borderColor: "#fff", borderWidth: 2 }]}
              onPress={() => { Haptics.selectionAsync(); setColor(c); }}
            />
          ))}
        </View>
      </View>

      {/* Icon */}
      <View>
        <Text style={s.label}>Icon</Text>
        <View style={s.iconGrid}>
          {PRESET_ICONS.map((ic) => (
            <Pressable
              key={ic}
              style={[s.iconBtn, icon === ic && { borderColor: color, backgroundColor: color + "20" }]}
              onPress={() => { Haptics.selectionAsync(); setIcon(ic); }}
            >
              <Feather name={ic as any} size={16} color={icon === ic ? color : colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Duration */}
      <View>
        <Text style={s.label}>Duration</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {DURATION_OPTIONS.map((d) => (
            <Pressable
              key={d}
              style={[s.chip, durationMin === d && { borderColor: color, backgroundColor: color + "20" }]}
              onPress={() => { Haptics.selectionAsync(); setDurationMin(d); }}
            >
              <Text style={[s.chipText, durationMin === d && { color }]}>
                {d < 60 ? `${d}m` : d < 120 ? `${d / 60}h` : `${d / 60}h`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Timer Mode */}
      <View>
        <Text style={s.label}>Mode</Text>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {TIMER_MODES.map((tm) => (
            <Pressable
              key={tm.key}
              style={[s.modeBtn, timerMode === tm.key && { borderColor: color, backgroundColor: color + "18" }]}
              onPress={() => { Haptics.selectionAsync(); setTimerMode(tm.key); }}
            >
              <Feather name={tm.icon as any} size={14} color={timerMode === tm.key ? color : colors.mutedForeground} />
              <Text style={[s.modeBtnText, timerMode === tm.key && { color }]}>{tm.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Break duration (only for pomodoro/interval) */}
      {needsBreak && (
        <View>
          <Text style={s.label}>Break Duration</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            {BREAK_OPTIONS.map((b) => (
              <Pressable
                key={b}
                style={[s.chip, breakMin === b && { borderColor: color, backgroundColor: color + "20" }]}
                onPress={() => { Haptics.selectionAsync(); setBreakMin(b); }}
              >
                <Text style={[s.chipText, breakMin === b && { color }]}>{formatMinutes(b)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Sound */}
      <View>
        <Text style={s.label}>Ambient Sound</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {AMBIENT_SOUNDS.map((snd) => (
            <Pressable
              key={snd.key}
              style={[s.chip, sound === snd.key && { borderColor: color, backgroundColor: color + "20" }]}
              onPress={() => { Haptics.selectionAsync(); setSound(snd.key); }}
            >
              <Feather name={snd.icon as any} size={12} color={sound === snd.key ? color : colors.mutedForeground} />
              <Text style={[s.chipText, sound === snd.key && { color }, { marginLeft: 5 }]}>{snd.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={s.divider} />

      {/* Toggles */}
      <View style={s.toggleRow}>
        <View>
          <Text style={s.toggleLabel}>Strict Mode</Text>
          <Text style={s.toggleSub}>Locks apps when this timer starts</Text>
        </View>
        <Switch
          value={strict}
          onValueChange={(v) => { Haptics.selectionAsync(); setStrict(v); }}
          trackColor={{ false: colors.border, true: colors.destructive }}
          thumbColor={colors.foreground}
          ios_backgroundColor={colors.border}
        />
      </View>
      <View style={s.toggleRow}>
        <View>
          <Text style={s.toggleLabel}>Auto Repeat</Text>
          <Text style={s.toggleSub}>Restart session automatically</Text>
        </View>
        <Switch
          value={autoRepeat}
          onValueChange={(v) => { Haptics.selectionAsync(); setAutoRepeat(v); }}
          trackColor={{ false: colors.border, true: color }}
          thumbColor={colors.foreground}
          ios_backgroundColor={colors.border}
        />
      </View>

      <View style={s.actions}>
        <Pressable style={s.cancelBtn} onPress={onCancel}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.mutedForeground }}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[s.saveBtn, { backgroundColor: color }]}
          onPress={() => {
            if (!name.trim()) { Alert.alert("Name required", "Please enter a session name."); return; }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSave({ name: name.trim(), icon, color, durationMin, breakMin, timerMode, strictMode: strict, autoRepeat, ambientSound: sound });
          }}
        >
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" }}>Save Timer</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Preset Card ──────────────────────────────────────────────────────────────

function PresetCard({ preset, onStart, onDelete }: { preset: CustomPreset; onStart: () => void; onDelete: () => void }) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        overflow: "hidden",
        flex: 1,
      }}
    >
      <View style={{ height: 3, backgroundColor: preset.color }} />
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={[{ width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" }, { backgroundColor: preset.color + "22" }]}>
            <Feather name={preset.icon as any} size={16} color={preset.color} />
          </View>
          <Pressable hitSlop={10} onPress={onDelete}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground, marginTop: 2 }} numberOfLines={2}>{preset.name}</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>
          {preset.durationMin < 60 ? `${preset.durationMin}m` : `${preset.durationMin / 60}h`}
          {preset.timerMode !== "countdown" ? ` · ${TIMER_MODES.find((m) => m.key === preset.timerMode)?.label}` : ""}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {preset.strictMode && (
            <View style={{ backgroundColor: colors.destructive + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: colors.destructive }}>STRICT</Text>
            </View>
          )}
          {preset.autoRepeat && (
            <View style={{ backgroundColor: preset.color + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, color: preset.color }}>LOOP</Text>
            </View>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [{
            backgroundColor: preset.color,
            borderRadius: 10,
            paddingVertical: 9,
            alignItems: "center",
            marginTop: 4,
          }, pressed && { opacity: 0.85 }]}
          onPress={onStart}
        >
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" }}>Start</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FocusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    currentSession, startSession, startCustomSession, stopSession, pauseSession, resumeSession,
    skipPomodoroBreak, todaySessions, totalFocusMs, streak, customPresets, addCustomPreset, removeCustomPreset,
  } = useFocus();

  const [selectedMode, setSelectedMode] = useState<SessionMode>("pomodoro");
  const [selectedAmbient, setSelectedAmbient] = useState("none");
  const [innerTab, setInnerTab] = useState<"sessions" | "custom">("sessions");
  const [showCreator, setShowCreator] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isActive = !!currentSession;
  const isPaused = currentSession?.paused ?? false;
  const isPomodoro = currentSession?.pomodoroState !== undefined;
  const ps = currentSession?.pomodoroState;
  const isStopwatch = currentSession?.timerMode === "stopwatch";

  const activeColor = currentSession?.customColor
    ?? MODES.find((m) => m.key === currentSession?.mode)?.color
    ?? colors.primary;

  const progress = currentSession
    ? isStopwatch
      ? Math.min((currentSession.remainingMs / (currentSession.durationMs || 1)) % 1, 1)
      : 1 - currentSession.remainingMs / (currentSession.durationMs || 1)
    : 0;

  const activeModeName = currentSession?.customPresetName
    ?? MODES.find((m) => m.key === currentSession?.mode)?.label
    ?? "Custom";

  const phaseLabelMap: Record<string, string> = {
    work: "Work Block",
    short_break: "Short Break",
    long_break: "Long Break",
  };

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
          <Text style={styles.headerTitle}>Focus</Text>
          {isActive && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeColor }} />
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: activeColor }}>
                {isPaused ? "Paused" : "In Session"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.streakBadge}>
          <Feather name="zap" size={12} color={colors.warning} />
          <Text style={styles.streakText}>{streak} day streak</Text>
        </View>
      </View>

      {/* ── ACTIVE SESSION ── */}
      {isActive && (
        <View style={styles.activeSection}>
          {/* Phase badge */}
          {isPomodoro && ps && (
            <View style={styles.phaseBadgeRow}>
              <View style={[styles.phaseBadge, { backgroundColor: ps.phase === "work" ? activeColor + "22" : colors.success + "22" }]}>
                <Text style={[styles.phaseBadgeText, { color: ps.phase === "work" ? activeColor : colors.success }]}>
                  {phaseLabelMap[ps.phase]} · Cycle {ps.completedCycles + 1}
                </Text>
              </View>
              <View style={styles.cycleDots}>
                {[1, 2, 3, 4].map((n) => (
                  <View key={n} style={[styles.cycleDot, n <= (ps.completedCycles % 4 || (ps.completedCycles > 0 ? 4 : 0)) && { backgroundColor: activeColor }]} />
                ))}
              </View>
            </View>
          )}

          {/* Orb Timer */}
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <BreathOrbTimer size={220} progress={progress} color={activeColor} isActive={!isPaused}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 54, color: colors.foreground, letterSpacing: -2, lineHeight: 60 }}>
                {formatTime(currentSession!.remainingMs, isStopwatch)}
              </Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: activeColor, marginTop: 2 }}>
                {activeModeName}
                {isPaused ? " · PAUSED" : ""}
              </Text>
              {isStopwatch && (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                  counting up
                </Text>
              )}
            </BreathOrbTimer>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <Pressable
              style={({ pressed }) => [styles.controlSm, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Alert.alert("End Session?", "This will save your progress.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "End", style: "destructive", onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); stopSession(); } },
                ]);
              }}
            >
              <Feather name="square" size={16} color={colors.destructive} />
              <Text style={[styles.controlSmText, { color: colors.destructive }]}>End</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.controlLg, { backgroundColor: activeColor }, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                isPaused ? resumeSession() : pauseSession();
              }}
            >
              <Feather name={isPaused ? "play" : "pause"} size={22} color="#fff" />
              <Text style={[styles.controlLgText, { color: "#fff" }]}>{isPaused ? "Resume" : "Pause"}</Text>
            </Pressable>

            {isPomodoro && ps?.phase !== "work" ? (
              <Pressable
                style={({ pressed }) => [styles.controlSm, pressed && { opacity: 0.7 }]}
                onPress={() => { Haptics.selectionAsync(); skipPomodoroBreak(); }}
              >
                <Feather name="skip-forward" size={16} color={activeColor} />
                <Text style={[styles.controlSmText, { color: activeColor }]}>Skip</Text>
              </Pressable>
            ) : (
              <View style={styles.controlSm} />
            )}
          </View>
        </View>
      )}

      {/* ── IDLE ── */}
      {!isActive && (
        <>
          {/* Quick stats */}
          <View style={styles.quickStats}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{todaySessions.filter((s) => s.completed).length}</Text>
              <Text style={styles.quickStatLabel}>Today</Text>
            </View>
            <View style={[styles.quickStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }]}>
              <Text style={styles.quickStatValue}>{formatMs(totalFocusMs)}</Text>
              <Text style={styles.quickStatLabel}>All Time</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{streak}</Text>
              <Text style={styles.quickStatLabel}>Streak</Text>
            </View>
          </View>

          {/* Inner tabs */}
          <View style={styles.innerTabs}>
            <Pressable
              style={[styles.innerTab, innerTab === "sessions" && styles.innerTabActive]}
              onPress={() => { Haptics.selectionAsync(); setInnerTab("sessions"); setShowCreator(false); }}
            >
              <Feather name="target" size={13} color={innerTab === "sessions" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.innerTabText, innerTab === "sessions" && { color: colors.primary }]}>Sessions</Text>
            </Pressable>
            <Pressable
              style={[styles.innerTab, innerTab === "custom" && styles.innerTabActive]}
              onPress={() => { Haptics.selectionAsync(); setInnerTab("custom"); }}
            >
              <Feather name="sliders" size={13} color={innerTab === "custom" ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.innerTabText, innerTab === "custom" && { color: colors.primary }]}>Custom ({customPresets.length})</Text>
            </Pressable>
          </View>

          {/* ── Sessions tab ── */}
          {innerTab === "sessions" && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Session Mode</Text>
                <View style={styles.modeList}>
                  {MODES.map((m) => (
                    <Pressable
                      key={m.key}
                      style={({ pressed }) => [
                        styles.modeCard,
                        selectedMode === m.key && { borderColor: m.color, backgroundColor: m.color + "10" },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => { Haptics.selectionAsync(); setSelectedMode(m.key); }}
                    >
                      <View style={[styles.modeIcon, { backgroundColor: m.color + "20" }]}>
                        <Feather name={m.icon as any} size={20} color={m.color} />
                      </View>
                      <View style={styles.modeInfo}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={[styles.modeName, selectedMode === m.key && { color: m.color }]}>{m.label}</Text>
                          {m.tag ? (
                            <View style={{ backgroundColor: m.color + "22", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 9, color: m.color, letterSpacing: 0.4 }}>{m.tag}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.modeDuration}>{m.duration}</Text>
                        <Text style={styles.modeDesc} numberOfLines={1}>{m.desc}</Text>
                      </View>
                      {selectedMode === m.key && <Feather name="check-circle" size={18} color={m.color} />}
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ambient Sound</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {AMBIENT_SOUNDS.map((snd) => (
                    <Pressable
                      key={snd.key}
                      style={({ pressed }) => [
                        styles.soundChip,
                        selectedAmbient === snd.key && { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() => { Haptics.selectionAsync(); setSelectedAmbient(snd.key); }}
                    >
                      <Feather name={snd.icon as any} size={13} color={selectedAmbient === snd.key ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.soundLabel, selectedAmbient === snd.key && { color: colors.primary }]}>{snd.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.startBtn,
                  { backgroundColor: MODES.find((m) => m.key === selectedMode)?.color ?? colors.primary },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  startSession(selectedMode);
                }}
              >
                <Feather name="play" size={20} color="#fff" />
                <Text style={styles.startBtnText}>
                  Start {MODES.find((m) => m.key === selectedMode)?.label}
                </Text>
              </Pressable>
            </>
          )}

          {/* ── Custom tab ── */}
          {innerTab === "custom" && (
            <View style={styles.section}>
              {!showCreator ? (
                <Pressable
                  style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => { Haptics.selectionAsync(); setShowCreator(true); }}
                >
                  <Feather name="plus" size={18} color={colors.primary} />
                  <Text style={styles.createBtnText}>Create New Timer</Text>
                </Pressable>
              ) : (
                <PresetCreator
                  onSave={(p) => { addCustomPreset(p); setShowCreator(false); }}
                  onCancel={() => setShowCreator(false)}
                />
              )}

              {customPresets.length === 0 && !showCreator && (
                <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
                  <Feather name="sliders" size={28} color={colors.mutedForeground} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: colors.foreground }}>No custom timers yet</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>
                    Create your own perfectly tuned focus sessions
                  </Text>
                </View>
              )}

              {/* 2-column preset grid */}
              {customPresets.length > 0 && (
                <View style={{ gap: 10, marginTop: showCreator ? 12 : 0 }}>
                  {Array.from({ length: Math.ceil(customPresets.length / 2) }, (_, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 10 }}>
                      {customPresets.slice(i * 2, i * 2 + 2).map((preset) => (
                        <PresetCard
                          key={preset.id}
                          preset={preset}
                          onStart={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            startCustomSession(preset);
                          }}
                          onDelete={() => {
                            Alert.alert("Delete Timer", `Remove "${preset.name}"?`, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Delete", style: "destructive", onPress: () => removeCustomPreset(preset.id) },
                            ]);
                          }}
                        />
                      ))}
                      {customPresets.slice(i * 2, i * 2 + 2).length === 1 && <View style={{ flex: 1 }} />}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 12 },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: c.foreground, letterSpacing: -0.7 },
    streakBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.warning + "18", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: c.warning + "44" },
    streakText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.warning },
    activeSection: { gap: 8, paddingHorizontal: 20 },
    phaseBadgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    phaseBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    phaseBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, letterSpacing: 0.2 },
    cycleDots: { flexDirection: "row", gap: 6 },
    cycleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#142840" },
    controls: { flexDirection: "row", gap: 10, alignItems: "center" },
    controlSm: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    controlSmText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
    controlLg: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 12 },
    controlLgText: { fontFamily: "Inter_700Bold", fontSize: 16 },
    quickStats: { flexDirection: "row", marginHorizontal: 20, marginBottom: 12, backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.glassBorder },
    quickStat: { flex: 1, alignItems: "center", paddingVertical: 14 },
    quickStatValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: c.foreground, letterSpacing: -0.5 },
    quickStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 2 },
    innerTabs: { flexDirection: "row", marginHorizontal: 20, marginBottom: 14, gap: 8 },
    innerTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    innerTabActive: { borderColor: c.primary + "66", backgroundColor: c.primary + "14" },
    innerTabText: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground },
    section: { paddingHorizontal: 20, marginBottom: 16 },
    sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: c.mutedForeground, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 12 },
    modeList: { gap: 9 },
    modeCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.glassBorder },
    modeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    modeInfo: { flex: 1, gap: 3 },
    modeName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground },
    modeDuration: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
    modeDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground },
    soundChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.card, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.glassBorder },
    soundLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
    startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 20, paddingVertical: 18, borderRadius: 16, marginBottom: 10 },
    startBtnText: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#fff", letterSpacing: -0.3 },
    createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: c.card, borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: c.glassBorder, marginBottom: 14, borderStyle: "dashed" },
    createBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.primary },
  });
}
