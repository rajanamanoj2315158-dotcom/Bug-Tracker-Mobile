import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUsage } from "@/context/UsageContext";

const HOLD_MS = 30000;
const MESSAGE_ROTATE_MS = 6000;
const MESSAGES = [
  "Distraction is not an accident. It is a choice.",
  "You are in a locked session. Finish what you started.",
  "Short-term urges are expensive. Stay in control.",
  "The timer ends. Your momentum should not.",
];

function formatRemaining(ms: number) {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function StrictModeOverlay() {
  const insets = useSafeAreaInsets();
  const {
    strictModeEnabled,
    activeSession,
    todayDistractionCount,
    whitelist,
    recordBypassAttempt,
    requestEmergencyUnlock,
    confirmEmergencyUnlock,
  } = useUsage();

  const [now, setNow] = useState(Date.now());
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const holdStartRef = useRef<number | null>(null);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const overlayActive = strictModeEnabled && activeSession !== null;

  useEffect(() => {
    if (!overlayActive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [overlayActive]);

  useEffect(() => {
    if (!overlayActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulseLoopRef.current = loop;
    loop.start();
    return () => {
      pulseLoopRef.current?.stop();
    };
  }, [overlayActive, pulse]);

  useEffect(() => {
    if (!overlayActive) return;
    const t = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, MESSAGE_ROTATE_MS);
    return () => clearInterval(t);
  }, [overlayActive]);

  useEffect(() => {
    if (!overlayActive) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      recordBypassAttempt();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Animated.sequence([
        Animated.timing(shake, { toValue: 10, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -10, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 8, duration: 35, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 35, useNativeDriver: true }),
      ]).start();
      return true;
    });
    return () => sub.remove();
  }, [overlayActive, recordBypassAttempt, shake]);

  useEffect(() => {
    if (!overlayActive || !holding) return;
    const timer = setInterval(() => {
      if (!holdStartRef.current) return;
      const elapsed = Date.now() - holdStartRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        setHolding(false);
        holdStartRef.current = null;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        confirmEmergencyUnlock();
      }
    }, 120);
    return () => clearInterval(timer);
  }, [overlayActive, holding, confirmEmergencyUnlock]);

  useEffect(() => {
    if (overlayActive) return;
    setHolding(false);
    setHoldProgress(0);
    holdStartRef.current = null;
  }, [overlayActive]);

  const remaining = useMemo(() => {
    if (!activeSession) return 0;
    return Math.max(0, activeSession.endTime - now);
  }, [activeSession, now]);

  if (!overlayActive || !activeSession) return null;

  const unlockState = requestEmergencyUnlock();
  const totalDuration = Math.max(1, activeSession.endTime - activeSession.startTime);
  const sessionPct = Math.min(1, Math.max(0, (now - activeSession.startTime) / totalDuration));
  const holdSec = Math.ceil((HOLD_MS * (1 - holdProgress)) / 1000);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.header}>
        <Text style={styles.headerKicker}>LOCKDOWN</Text>
        <Text style={styles.title}>Strict Mode Active</Text>
      </View>

      <Animated.View style={[styles.mainCard, { transform: [{ translateX: shake }] }]}>
        <Animated.View style={[styles.lockCircle, { transform: [{ scale: pulse }] }]}>
          <Feather name="shield-off" size={42} color="#fca5a5" />
        </Animated.View>
        <Text style={styles.message}>{MESSAGES[messageIndex]}</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Time Left</Text>
          <Text style={styles.rowValue}>{formatRemaining(remaining)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Bypass Attempts</Text>
          <Text style={styles.rowValue}>{activeSession.bypassAttempts}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Distractions Today</Text>
          <Text style={styles.rowValue}>{todayDistractionCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Mode</Text>
          <Text style={styles.rowValue}>{activeSession.mode.replace("_", " ")}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${sessionPct * 100}%` }]} />
        </View>
      </Animated.View>

      <View style={styles.whitelistCard}>
        <Text style={styles.whitelistTitle}>Allowed Apps</Text>
        <View style={styles.whitelistChips}>
          {whitelist.slice(0, 8).map((item) => (
            <View key={item.name} style={styles.whitelistChip}>
              <Feather name={item.icon as any} size={10} color="#86efac" />
              <Text style={styles.whitelistChipText}>{item.name}</Text>
            </View>
          ))}
          {whitelist.length === 0 && <Text style={styles.note}>No whitelist apps configured.</Text>}
        </View>
      </View>

      <Pressable
        disabled={!unlockState.allowed}
        onPressIn={() => {
          if (!unlockState.allowed) return;
          setHolding(true);
          holdStartRef.current = Date.now();
          setHoldProgress(0);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        onPressOut={() => {
          setHolding(false);
          holdStartRef.current = null;
          if (holdProgress < 1) setHoldProgress(0);
        }}
        style={[styles.emergencyBtn, !unlockState.allowed && styles.emergencyBtnDisabled]}
      >
        <Text style={styles.emergencyText}>
          {unlockState.allowed
            ? holding ? `Keep holding (${holdSec}s)` : "Hold 30s for emergency unlock"
            : `Cooldown: ${Math.ceil(unlockState.cooldownRemainingMs / 60000)} min`}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${holdProgress * 100}%` }]} />
        </View>
      </Pressable>

      <Text style={styles.note}>
        Session id: {activeSession.id.slice(0, 12)}. Restarting app does not end strict mode.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 20,
    backgroundColor: "#080a12",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    gap: 12,
  },
  header: { width: "100%", alignItems: "center", gap: 4 },
  headerKicker: { color: "#fb7185", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  title: { color: "#fafafa", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  mainCard: {
    width: "100%",
    backgroundColor: "#101322",
    borderWidth: 1,
    borderColor: "#272a3d",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 9,
  },
  lockCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    borderColor: "#7f1d1d",
    backgroundColor: "#1d1120",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: Platform.OS === "ios" ? 2 : 0,
  },
  message: { color: "#fca5a5", fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { color: "#a1a1aa", fontFamily: "Inter_500Medium", fontSize: 12 },
  rowValue: { color: "#f4f4f5", fontFamily: "Inter_700Bold", fontSize: 14, textTransform: "capitalize" },
  track: { height: 6, borderRadius: 99, backgroundColor: "#222633", overflow: "hidden", marginTop: 3 },
  trackFill: { height: "100%", backgroundColor: "#fb7185" },
  whitelistCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#243244",
    backgroundColor: "#0e1927",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  whitelistTitle: { color: "#d4d4d8", fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  whitelistChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  whitelistChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#14532d",
    backgroundColor: "#052e16",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  whitelistChipText: { color: "#bbf7d0", fontFamily: "Inter_500Medium", fontSize: 11 },
  emergencyBtn: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    borderRadius: 14,
    backgroundColor: "#1f1010",
    padding: 12,
    gap: 10,
  },
  emergencyBtnDisabled: { borderColor: "#3f3f46", backgroundColor: "#16161a" },
  emergencyText: { color: "#fecaca", fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "center" },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "#2a2a2f", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#ef4444" },
  note: { color: "#71717a", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});
