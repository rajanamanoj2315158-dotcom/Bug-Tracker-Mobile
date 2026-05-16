import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFocus } from "@/context/FocusContext";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, blockedApps } = useFocus();
  const [haptics, setHaptics] = useState(true);
  const [autoBreak, setAutoBreak] = useState(false);
  const [strictMode, setStrictMode] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const styles = makeStyles(colors);

  function SettingRow({
    icon,
    label,
    desc,
    value,
    onToggle,
    accentColor,
  }: {
    icon: string;
    label: string;
    desc?: string;
    value: boolean;
    onToggle: (v: boolean) => void;
    accentColor?: string;
  }) {
    return (
      <View style={styles.settingRow}>
        <View style={[styles.settingIcon, { backgroundColor: (accentColor ?? colors.primary) + "22" }]}>
          <Feather name={icon as any} size={16} color={accentColor ?? colors.primary} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>{label}</Text>
          {desc && <Text style={styles.settingDesc}>{desc}</Text>}
        </View>
        <Switch
          value={value}
          onValueChange={(v) => {
            Haptics.selectionAsync();
            onToggle(v);
          }}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.primaryForeground}
          ios_backgroundColor={colors.border}
        />
      </View>
    );
  }

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: topPad + 20, paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Profile Card */}
      <View style={[styles.profileCard]}>
        <View style={styles.avatarCircle}>
          <Feather name="shield" size={26} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.profileName}>Focus Shield</Text>
          <Text style={styles.profileSub}>Protecting your focus</Text>
        </View>
      </View>

      {/* Session Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session</Text>
        <View style={styles.card}>
          <SettingRow
            icon="zap"
            label="Haptic Feedback"
            desc="Vibrate on session events"
            value={haptics}
            onToggle={setHaptics}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="coffee"
            label="Auto-Break Reminders"
            desc="Get reminded to take a break"
            value={autoBreak}
            onToggle={setAutoBreak}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="lock"
            label="Strict Mode"
            desc="Cannot stop sessions early"
            value={strictMode}
            onToggle={setStrictMode}
            accentColor={colors.destructive}
          />
        </View>
      </View>

      {/* Stats Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Data</Text>
        <View style={styles.card}>
          <InfoRow label="Total Sessions" value={sessions.length.toString()} />
          <View style={styles.rowDivider} />
          <InfoRow label="Blocked Apps" value={blockedApps.length.toString()} />
          <View style={styles.rowDivider} />
          <InfoRow
            label="Sessions Completed"
            value={sessions.filter((s) => s.completed).length.toString()}
          />
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <InfoRow label="App" value="Focus Shield" />
          <View style={styles.rowDivider} />
          <InfoRow label="Version" value="1.0.0" />
          <View style={styles.rowDivider} />
          <InfoRow label="Build" value="Final Hardened Release" />
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Feather name="info" size={14} color={colors.primary} />
        <Text style={styles.infoBannerText}>
          Focus Shield helps you stay on task by tracking focused sessions and managing your distraction list. Enable accessibility permissions on your device for full app blocking support.
        </Text>
      </View>
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
      paddingHorizontal: 24,
      marginBottom: 24,
    },
    headerTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 26,
      color: colors.foreground,
      letterSpacing: -0.8,
    },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginHorizontal: 20,
      marginBottom: 24,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    avatarCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.primary + "55",
    },
    profileName: {
      fontFamily: "Inter_700Bold",
      fontSize: 18,
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    profileSub: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    sectionTitle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.mutedForeground,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 14,
    },
    settingIcon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    settingInfo: {
      flex: 1,
    },
    settingLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 15,
      color: colors.foreground,
    },
    settingDesc: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 62,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    infoLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 15,
      color: colors.foreground,
    },
    infoValue: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
      color: colors.mutedForeground,
    },
    infoBanner: {
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 20,
      backgroundColor: colors.primary + "14",
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.primary + "33",
      alignItems: "flex-start",
    },
    infoBannerText: {
      flex: 1,
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 20,
    },
  });
}
