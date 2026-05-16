import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFocus } from "@/context/FocusContext";

const PRESETS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Twitter / X",
  "Reddit",
  "Facebook",
  "Snapchat",
  "Discord",
  "Twitch",
  "LinkedIn",
  "WhatsApp",
  "Telegram",
  "Netflix",
  "Spotify",
];

export default function AppsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { blockedApps, addBlockedApp, removeBlockedApp } = useFocus();
  const [input, setInput] = useState("");
  const [showPresets, setShowPresets] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const unaddedPresets = PRESETS.filter((p) => !blockedApps.includes(p));

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (blockedApps.includes(trimmed)) {
      Alert.alert("Already blocked", `"${trimmed}" is already in your blocked list.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addBlockedApp(trimmed);
    setInput("");
  }

  function handleRemove(app: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeBlockedApp(app);
  }

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Blocked Apps</Text>
        <Text style={styles.headerSub}>{blockedApps.length} apps blocked</Text>
      </View>

      {/* Add Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add app name..."
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.75 }]}
          onPress={handleAdd}
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {/* Presets toggle */}
      {unaddedPresets.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.presetsToggle, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.selectionAsync();
            setShowPresets((v) => !v);
          }}
        >
          <Feather name={showPresets ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
          <Text style={styles.presetsToggleText}>
            {showPresets ? "Hide suggestions" : `Add from suggestions (${unaddedPresets.length})`}
          </Text>
        </Pressable>
      )}

      {/* Presets */}
      {showPresets && (
        <View style={styles.presetGrid}>
          {unaddedPresets.map((preset) => (
            <Pressable
              key={preset}
              style={({ pressed }) => [styles.presetChip, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Haptics.selectionAsync();
                addBlockedApp(preset);
              }}
            >
              <Feather name="plus" size={12} color={colors.primary} />
              <Text style={styles.presetChipText}>{preset}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      {/* Blocked Apps List */}
      <FlatList
        data={blockedApps}
        keyExtractor={(item) => item}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad + 100,
          gap: 8,
        }}
        scrollEnabled={!!blockedApps.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="shield-off" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No apps blocked</Text>
            <Text style={styles.emptySub}>Add apps above to block them during focus sessions</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.appRow}>
            <View style={styles.appIconPlaceholder}>
              <Feather name="smartphone" size={16} color={colors.primary} />
            </View>
            <Text style={styles.appName}>{item}</Text>
            <View style={styles.blockedBadge}>
              <Text style={styles.blockedBadgeText}>BLOCKED</Text>
            </View>
            <Pressable
              hitSlop={12}
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
              onPress={() => handleRemove(item)}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
      />
    </View>
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
      paddingBottom: 20,
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 26,
      color: colors.foreground,
      letterSpacing: -0.8,
    },
    headerSub: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.mutedForeground,
    },
    inputRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 10,
      marginBottom: 12,
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontFamily: "Inter_400Regular",
      fontSize: 15,
      color: colors.foreground,
    },
    addBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      width: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    presetsToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    presetsToggleText: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: colors.primary,
    },
    presetGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 8,
      marginBottom: 12,
    },
    presetChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 99,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    presetChipText: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.foreground,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
      marginBottom: 16,
    },
    empty: {
      alignItems: "center",
      paddingTop: 60,
      gap: 10,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    },
    emptyTitle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 16,
      color: colors.foreground,
    },
    emptySub: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      maxWidth: 260,
      lineHeight: 20,
    },
    appRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    appIconPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 9,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    appName: {
      flex: 1,
      fontFamily: "Inter_500Medium",
      fontSize: 15,
      color: colors.foreground,
    },
    blockedBadge: {
      backgroundColor: colors.destructive + "22",
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    blockedBadgeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 9,
      color: colors.destructive,
      letterSpacing: 0.8,
    },
    removeBtn: {
      padding: 4,
    },
  });
}
