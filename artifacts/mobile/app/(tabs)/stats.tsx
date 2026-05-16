import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { SessionRecord, useFocus } from "@/context/FocusContext";

function formatMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return "Today";
  const isYesterday =
    d.getDate() === now.getDate() - 1 &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime12(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const MODE_LABELS: Record<string, string> = {
  study: "Study",
  focus: "Focus",
  deep: "Deep Work",
};

function WeekBar({ sessions }: { sessions: SessionRecord[] }) {
  const colors = useColors();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });

  const maxMs = Math.max(
    ...days.map((d) => {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      return sessions
        .filter((s) => {
          const sd = new Date(s.startedAt);
          return `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}` === key;
        })
        .reduce((acc, s) => acc + s.completedMs, 0);
    }),
    1
  );

  const styles = StyleSheet.create({
    wrap: { flexDirection: "row", gap: 6, alignItems: "flex-end", height: 80 },
    col: { flex: 1, alignItems: "center", gap: 4 },
    bar: { width: "100%", borderRadius: 4, minHeight: 4 },
    dayLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 10,
      color: colors.mutedForeground,
    },
  });

  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View style={styles.wrap}>
      {days.map((d, i) => {
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const totalMs = sessions
          .filter((s) => {
            const sd = new Date(s.startedAt);
            return `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}` === key;
          })
          .reduce((acc, s) => acc + s.completedMs, 0);
        const ratio = totalMs / maxMs;
        const isToday = i === 6;
        return (
          <View key={i} style={styles.col}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(4, 60 * ratio),
                  backgroundColor: isToday
                    ? colors.primary
                    : totalMs > 0
                    ? colors.primary + "55"
                    : colors.card,
                },
              ]}
            />
            <Text style={[styles.dayLabel, isToday && { color: colors.primary }]}>
              {DAY_LABELS[d.getDay()]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, streak, todayFocusMs, totalSessions } = useFocus();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const totalFocusMs = sessions.reduce((acc, s) => acc + s.completedMs, 0);
  const completedCount = sessions.filter((s) => s.completed).length;
  const completionRate = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

  const styles = makeStyles(colors);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: topPad + 20, paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      {/* Highlight cards */}
      <View style={styles.highlightRow}>
        <View style={[styles.highlightCard, styles.highlightCardPrimary]}>
          <Text style={styles.highlightValue}>{streak}</Text>
          <Text style={styles.highlightLabel}>Day Streak</Text>
          <View style={styles.highlightIcon}>
            <Feather name="zap" size={14} color={colors.primary} />
          </View>
        </View>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightValue}>{formatMs(todayFocusMs)}</Text>
          <Text style={styles.highlightLabel}>Today</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{totalSessions}</Text>
          <Text style={styles.statBoxLabel}>Total Sessions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{formatMs(totalFocusMs)}</Text>
          <Text style={styles.statBoxLabel}>Total Focus Time</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{completionRate}%</Text>
          <Text style={styles.statBoxLabel}>Completion Rate</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{completedCount}</Text>
          <Text style={styles.statBoxLabel}>Completed</Text>
        </View>
      </View>

      {/* Weekly Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.card}>
          <WeekBar sessions={sessions} />
        </View>
      </View>

      {/* Session History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session History</Text>
        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="clock" size={26} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySub}>Start your first focus session to see history here</Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {sessions.slice(0, 20).map((s) => (
              <View key={s.id} style={styles.sessionRow}>
                <View style={[styles.sessionDot, { backgroundColor: s.completed ? colors.success : colors.warning }]} />
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionMode}>{MODE_LABELS[s.mode] ?? s.mode}</Text>
                  <Text style={styles.sessionDate}>
                    {formatDate(s.startedAt)} · {formatTime12(s.startedAt)}
                  </Text>
                </View>
                <View style={styles.sessionRight}>
                  <Text style={styles.sessionDuration}>{formatMs(s.completedMs)}</Text>
                  {s.completed ? (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>Done</Text>
                    </View>
                  ) : (
                    <View style={styles.partialBadge}>
                      <Text style={styles.partialBadgeText}>Partial</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
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
    highlightRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 10,
      marginBottom: 10,
    },
    highlightCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    highlightCardPrimary: {
      backgroundColor: colors.primary + "18",
      borderColor: colors.primary + "55",
    },
    highlightValue: {
      fontFamily: "Inter_700Bold",
      fontSize: 32,
      color: colors.foreground,
      letterSpacing: -1,
    },
    highlightLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    highlightIcon: {
      position: "absolute",
      top: 16,
      right: 16,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 20,
      gap: 10,
      marginBottom: 24,
    },
    statBox: {
      width: "47%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statBoxValue: {
      fontFamily: "Inter_700Bold",
      fontSize: 22,
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    statBoxLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 3,
    },
    section: {
      paddingHorizontal: 20,
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
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    empty: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 8,
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    },
    emptyTitle: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
      color: colors.foreground,
    },
    emptySub: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      maxWidth: 240,
      lineHeight: 20,
    },
    historyList: {
      gap: 8,
    },
    sessionRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    sessionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    sessionInfo: {
      flex: 1,
    },
    sessionMode: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: colors.foreground,
    },
    sessionDate: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    sessionRight: {
      alignItems: "flex-end",
      gap: 4,
    },
    sessionDuration: {
      fontFamily: "Inter_700Bold",
      fontSize: 14,
      color: colors.foreground,
    },
    completedBadge: {
      backgroundColor: colors.success + "22",
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    completedBadgeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 10,
      color: colors.success,
    },
    partialBadge: {
      backgroundColor: colors.warning + "22",
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    partialBadgeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 10,
      color: colors.warning,
    },
  });
}
