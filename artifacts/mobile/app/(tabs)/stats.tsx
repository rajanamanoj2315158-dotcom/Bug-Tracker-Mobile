import { Feather } from "@expo/vector-icons";
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
import { SessionRecord, useFocus } from "@/context/FocusContext";
import { useUsage } from "@/context/UsageContext";

type Period = "week" | "month";

function formatMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

function getDayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = getDayKey(ts) === getDayKey(Date.now());
  const isYest = getDayKey(ts) === getDayKey(Date.now() - 86400000);
  if (isToday) return "Today";
  if (isYest) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime12(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

const MODE_META: Record<string, { label: string; color: string; icon: string }> = {
  pomodoro: { label: "Pomodoro", color: "#f59e0b", icon: "clock" },
  study: { label: "Study", color: "#38bdf8", icon: "book-open" },
  deep: { label: "Deep Work", color: "#6366f1", icon: "anchor" },
  detox: { label: "Detox", color: "#ec4899", icon: "x-circle" },
  monk: { label: "Monk Mode", color: "#8b5cf6", icon: "moon" },
  founder: { label: "Founder", color: "#f97316", icon: "briefcase" },
};

function WeekChart({ sessions, period }: { sessions: SessionRecord[]; period: Period }) {
  const colors = useColors();
  const now = Date.now();
  const days = period === "week"
    ? Array.from({ length: 7 }, (_, i) => new Date(now - (6 - i) * 86400000))
    : Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay() - (3 - i) * 7);
      return { weekStart: d.getTime() };
    });

  if (period === "week") {
    const dayMs = (days as Date[]).map((d) => {
      const key = getDayKey(d.getTime());
      return sessions.filter((s) => getDayKey(s.startedAt) === key).reduce((a, s) => a + s.completedMs, 0);
    });
    const maxMs = Math.max(...dayMs, 1);
    const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 80 }}>
        {(days as Date[]).map((d, i) => {
          const ratio = dayMs[i] / maxMs;
          const isToday = i === 6;
          return (
            <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              {dayMs[i] > 0 && (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 8, color: colors.mutedForeground }}>
                  {Math.floor(dayMs[i] / 3600000) > 0 ? `${Math.floor(dayMs[i] / 3600000)}h` : `${Math.floor(dayMs[i] / 60000)}m`}
                </Text>
              )}
              <View style={{ width: "100%", borderRadius: 4, height: Math.max(4, 55 * ratio), backgroundColor: isToday ? colors.primary : dayMs[i] > 0 ? colors.primary + "55" : colors.border }} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: isToday ? colors.primary : colors.mutedForeground }}>
                {DAY_LABELS[(d as Date).getDay()]}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  const weekLabels = ["3w ago", "2w ago", "1w ago", "This wk"];
  const weekMs = (days as { weekStart: number }[]).map(({ weekStart }) =>
    sessions
      .filter((s) => s.startedAt >= weekStart && s.startedAt < weekStart + 7 * 86400000)
      .reduce((a, s) => a + s.completedMs, 0)
  );
  const maxMs = Math.max(...weekMs, 1);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 80 }}>
      {weekMs.map((ms, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
          <View style={{ width: "100%", borderRadius: 4, height: Math.max(4, 60 * ms / maxMs), backgroundColor: i === 3 ? colors.primary : colors.primary + "55" }} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground }}>{weekLabels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

function ModePieChart({ sessions }: { sessions: SessionRecord[] }) {
  const colors = useColors();
  const byMode: Record<string, number> = {};
  sessions.forEach((s) => {
    byMode[s.mode] = (byMode[s.mode] ?? 0) + s.completedMs;
  });
  const total = Object.values(byMode).reduce((a, b) => a + b, 0) || 1;
  const entries = Object.entries(byMode).sort((a, b) => b[1] - a[1]);

  return (
    <View style={{ gap: 10 }}>
      {entries.map(([mode, ms]) => {
        const meta = MODE_META[mode] ?? { label: mode, color: colors.primary, icon: "circle" };
        const pct = Math.round((ms / total) * 100);
        return (
          <View key={mode} style={{ gap: 5 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: meta.color }} />
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.foreground }}>{meta.label}</Text>
              </View>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground }}>{pct}% · {formatMs(ms)}</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" }}>
              <View style={{ height: 4, width: `${pct}%`, backgroundColor: meta.color, borderRadius: 2 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, streak, bestStreak, todayFocusMs, weekFocusMs, totalFocusMs, productivityScore, level, totalSessions } = useFocus();
  const { todayUsageByCategory, categoryColors } = useUsage();
  const [period, setPeriod] = useState<Period>("week");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const completedSessions = sessions.filter((s) => s.completed).length;
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const avgSessionMs = totalSessions > 0 ? totalFocusMs / totalSessions : 0;

  const scoreColor = productivityScore >= 80 ? colors.success : productivityScore >= 50 ? colors.primary : colors.warning;
  const styles = makeStyles(colors);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.periodToggle}>
          {(["week", "month"] as Period[]).map((p) => (
            <Pressable
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, period === p && { color: colors.primaryForeground }]}>
                {p === "week" ? "Week" : "Month"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Score + Level */}
      <View style={styles.heroRow}>
        <View style={[styles.heroCard, { borderColor: scoreColor + "55", backgroundColor: scoreColor + "10" }]}>
          <Text style={[styles.heroValue, { color: scoreColor }]}>{productivityScore}</Text>
          <Text style={styles.heroLabel}>Today's Score</Text>
          <View style={[styles.heroBadge, { backgroundColor: scoreColor + "22" }]}>
            <Text style={[styles.heroBadgeText, { color: scoreColor }]}>
              {productivityScore >= 80 ? "Excellent" : productivityScore >= 50 ? "Good" : "Building"}
            </Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <View style={styles.metaCard}>
            <Text style={styles.metaValue}>{streak}</Text>
            <Text style={styles.metaLabel}>Current Streak</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaValue}>{bestStreak}</Text>
            <Text style={styles.metaLabel}>Best Streak</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={[styles.metaValue, { color: colors.primary }]}>LV {level}</Text>
            <Text style={styles.metaLabel}>Focus Level</Text>
          </View>
        </View>
      </View>

      {/* Focus Time Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Focus Time</Text>
        <View style={styles.statsGrid}>
          {[
            { label: "Today", value: formatMs(todayFocusMs), color: colors.primary },
            { label: "This Week", value: formatMs(weekFocusMs), color: colors.accent },
            { label: "All Time", value: formatMs(totalFocusMs), color: colors.success },
            { label: "Avg Session", value: formatMs(avgSessionMs), color: colors.warning },
          ].map((stat) => (
            <View key={stat.label} style={styles.statBox}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{period === "week" ? "Last 7 Days" : "Last 4 Weeks"}</Text>
        <View style={styles.card}>
          <WeekChart sessions={sessions} period={period} />
        </View>
      </View>

      {/* Session breakdown */}
      {sessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Breakdown</Text>
          <View style={[styles.card, { padding: 16 }]}>
            <ModePieChart sessions={sessions} />
          </View>
        </View>
      )}

      {/* Sessions stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session Stats</Text>
        <View style={styles.statsGrid}>
          {[
            { label: "Total Sessions", value: totalSessions.toString() },
            { label: "Completed", value: completedSessions.toString() },
            { label: "Completion Rate", value: `${completionRate}%` },
            { label: "Partial", value: (totalSessions - completedSessions).toString() },
          ].map((stat) => (
            <View key={stat.label} style={styles.statBox}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Session History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="clock" size={28} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySub}>Complete a focus session to see history</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {sessions.slice(0, 15).map((s) => {
              const meta = MODE_META[s.mode] ?? { label: s.mode, color: colors.primary, icon: "circle" };
              return (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={[styles.sessionModeIcon, { backgroundColor: meta.color + "20" }]}>
                    <Feather name={meta.icon as any} size={14} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionModeLabel}>{meta.label}</Text>
                    <Text style={styles.sessionDate}>{formatDate(s.startedAt)} · {formatTime12(s.startedAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={styles.sessionDuration}>{formatMs(s.completedMs)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: (s.completed ? colors.success : colors.warning) + "22" }]}>
                      <Text style={[styles.statusText, { color: s.completed ? colors.success : colors.warning }]}>
                        {s.completed ? "Done" : "Partial"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 20 },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: c.foreground, letterSpacing: -0.6 },
    periodToggle: { flexDirection: "row", backgroundColor: c.card, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: c.border },
    periodBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    periodBtnActive: { backgroundColor: c.primary },
    periodBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground },
    heroRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 24 },
    heroCard: { width: 130, backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, alignItems: "center", gap: 4 },
    heroValue: { fontFamily: "Inter_700Bold", fontSize: 48, letterSpacing: -2 },
    heroLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground },
    heroBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
    heroBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.3 },
    metaCard: { flex: 1, backgroundColor: c.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 8 },
    metaValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: c.foreground, letterSpacing: -0.5 },
    metaLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.mutedForeground, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 12 },
    card: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statBox: { width: "47%", backgroundColor: c.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border },
    statValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: c.foreground, letterSpacing: -0.5 },
    statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 4 },
    empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
    emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground },
    emptySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center" },
    sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border },
    sessionModeIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    sessionModeLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground },
    sessionDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 2 },
    sessionDuration: { fontFamily: "Inter_700Bold", fontSize: 13, color: c.foreground },
    statusBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    statusText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  });
}
