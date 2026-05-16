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
    recordBypassAttempt,
    requestEmergencyUnlock,
    confirmEmergencyUnlock,
  } = useUsage();

  const [now, setNow] = useState(Date.now());
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const holdStartRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  useEffect(() => {
    if (!strictModeEnabled) return;
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
  }, [recordBypassAttempt, shake, strictModeEnabled]);

  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => {
      if (!holdStartRef.current) return;
      const elapsed = Date.now() - holdStartRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        setHolding(false);
        setHoldProgress(1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        confirmEmergencyUnlock();
      }
    }, 120);
    return () => clearInterval(timer);
  }, [holding, confirmEmergencyUnlock]);

  const remaining = useMemo(() => {
    if (!activeSession) return 0;
    return Math.max(0, activeSession.endTime - now);
  }, [activeSession, now]);

  if (!strictModeEnabled || !activeSession) return null;

  const unlockState = requestEmergencyUnlock();
  const holdSec = Math.ceil((HOLD_MS * (1 - holdProgress)) / 1000);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 16 }]}>
      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        <Animated.View style={[styles.lock, { transform: [{ scale: pulse }] }]}>
          <Feather name="shield" size={64} color="#f87171" />
        </Animated.View>
      </Animated.View>

      <Text style={styles.title}>STRICT MODE ACTIVE</Text>
      <Text style={styles.sub}>This session is locked until timer completion.</Text>

      <View style={styles.stats}>
        <Stat label="Time Left" value={formatRemaining(remaining)} />
        <Stat label="Bypass Attempts" value={String(activeSession.bypassAttempts)} />
        <Stat label="Distractions Today" value={String(todayDistractionCount)} />
      </View>

      <Text style={styles.note}>
        Restarting the app does not disable strict mode. Session id: {activeSession.id.slice(0, 12)}
      </Text>

      <View style={styles.footer}>
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
              ? holding
                ? `Keep holding (${holdSec}s)`
                : "Hold 30s for emergency unlock"
              : `Cooldown: ${Math.ceil(unlockState.cooldownRemainingMs / 60000)} min`}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${holdProgress * 100}%` }]} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 20,
    backgroundColor: "#09090b",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  lock: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#7f1d1d",
    backgroundColor: "#1c1917",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Platform.OS === "ios" ? 8 : 0,
  },
  title: { color: "#fafafa", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  sub: { color: "#a1a1aa", fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: -16 },
  stats: { width: "100%", gap: 10 },
  statCard: {
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: { color: "#a1a1aa", fontFamily: "Inter_500Medium", fontSize: 13 },
  statValue: { color: "#fef2f2", fontFamily: "Inter_700Bold", fontSize: 15 },
  note: { color: "#71717a", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  footer: { width: "100%" },
  emergencyBtn: {
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
});
