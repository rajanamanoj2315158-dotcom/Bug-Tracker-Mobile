import { Feather } from "@expo/vector-icons";
import * as Battery from "expo-battery";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
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
import {
  AppBlockConfig,
  AppCategory,
  AppEntry,
  BlockTrigger,
  TRIGGER_META,
  useUsage,
  WhitelistEntry,
} from "@/context/UsageContext";

type Tab = "apps" | "schedule" | "reels" | "strict" | "rules";

const CATEGORIES: { key: AppCategory; label: string; color: string }[] = [
  { key: "social", label: "Social", color: "#f43f5e" },
  { key: "entertainment", label: "Entertainment", color: "#f59e0b" },
  { key: "gaming", label: "Gaming", color: "#a855f7" },
  { key: "communication", label: "Communication", color: "#38bdf8" },
  { key: "productive", label: "Productive", color: "#22c55e" },
  { key: "news", label: "News", color: "#64748b" },
  { key: "other", label: "Other", color: "#475569" },
];

const TRIGGER_GROUPS: { label: string; triggers: BlockTrigger[] }[] = [
  { label: "Mode-based", triggers: ["always", "study_mode", "deep_work", "monk_mode", "detox_mode", "exam_mode"] },
  { label: "Time-based", triggers: ["scheduled", "sleep_hours"] },
  { label: "Frequency", triggers: ["weekdays_only", "weekends_only", "alternate_days"] },
  { label: "Usage-based", triggers: ["usage_limit"] },
];

const WHITELIST_PRESETS: WhitelistEntry[] = [
  { name: "Phone", icon: "phone" },
  { name: "Messages", icon: "message-circle" },
  { name: "Calculator", icon: "hash" },
  { name: "Notes", icon: "file-text" },
  { name: "Maps", icon: "map-pin" },
  { name: "Camera", icon: "camera" },
  { name: "Email", icon: "mail" },
  { name: "Calendar", icon: "calendar" },
  { name: "Clock", icon: "clock" },
  { name: "Settings", icon: "settings" },
  { name: "Contacts", icon: "users" },
  { name: "Browser", icon: "globe" },
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function getPrimaryTriggerLabel(config: AppBlockConfig): { label: string; color: string } {
  if (config.permanent) return { label: "Permanent", color: "#ef4444" };
  if (config.triggers.includes("always")) return { label: "Always", color: "#ef4444" };
  if (config.triggers.includes("scheduled")) {
    return { label: `${config.startTime}–${config.endTime}`, color: "#38bdf8" };
  }
  if (config.triggers.length > 0) {
    const t = config.triggers[0];
    const m = TRIGGER_META[t];
    return { label: m.label, color: m.color };
  }
  return { label: "Off", color: "#475569" };
}

// ─── Schedule Timeline ────────────────────────────────────────────────────────

function ScheduleTimeline({ apps }: { apps: AppEntry[] }) {
  const colors = useColors();
  const HOURS = Array.from({ length: 25 }, (_, i) => i);

  const scheduledApps = apps.filter(
    (a) => a.blocked && (
      a.blockConfig.triggers.includes("scheduled") ||
      a.blockConfig.triggers.includes("always") ||
      a.blockConfig.triggers.includes("sleep_hours")
    )
  );

  const colorMap = useMemo(() => {
    const COLORS = ["#ef4444", "#f59e0b", "#6366f1", "#ec4899", "#38bdf8", "#22c55e", "#a855f7", "#f97316"];
    return Object.fromEntries(scheduledApps.map((a, i) => [a.name, COLORS[i % COLORS.length]]));
  }, [scheduledApps]);

  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const currentPct = (currentMinute / 1440) * 100;

  const styles = StyleSheet.create({
    wrap: { gap: 16 },
    timeRow: { flexDirection: "row", alignItems: "center", paddingLeft: 70 },
    timeLabel: { position: "absolute", fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground },
    appRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 28 },
    appLabel: { width: 60, fontFamily: "Inter_400Regular", fontSize: 11, color: colors.foreground, textAlign: "right" },
    trackBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.border, position: "relative", overflow: "visible" },
    blockBar: { position: "absolute", top: 0, height: 10, borderRadius: 5 },
    nowLine: { position: "absolute", top: -3, width: 2, height: 16, backgroundColor: colors.primary, borderRadius: 1, zIndex: 10 },
    nowDot: { position: "absolute", top: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, zIndex: 11, marginLeft: -2 },
    legend: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground },
    hourTick: { position: "absolute", top: 0, width: 1, height: 10, backgroundColor: colors.border + "80" },
  });

  return (
    <View style={styles.wrap}>
      {/* Hour markers */}
      <View style={{ flexDirection: "row", paddingLeft: 70 }}>
        <View style={{ flex: 1, position: "relative", height: 14 }}>
          {[0, 6, 12, 18, 24].map((h) => (
            <Text
              key={h}
              style={[styles.timeLabel, { left: `${(h / 24) * 100}%` }]}
            >
              {h === 0 ? "12am" : h === 6 ? "6am" : h === 12 ? "12pm" : h === 18 ? "6pm" : "12am"}
            </Text>
          ))}
        </View>
      </View>

      {/* App rows */}
      {scheduledApps.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
          <Feather name="calendar" size={24} color={colors.mutedForeground} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground }}>
            No scheduled blocks. Enable apps with scheduled triggers.
          </Text>
        </View>
      ) : (
        scheduledApps.map((app) => {
          const cfg = app.blockConfig;
          const color = colorMap[app.name];
          const bars: { left: number; width: number }[] = [];

          if (cfg.triggers.includes("always")) {
            bars.push({ left: 0, width: 100 });
          } else if (cfg.triggers.includes("sleep_hours")) {
            bars.push({ left: (22 * 60) / 1440 * 100, width: (9 * 60) / 1440 * 100 });
          } else if (cfg.triggers.includes("scheduled")) {
            const startMin = timeToMinutes(cfg.startTime);
            const endMin = timeToMinutes(cfg.endTime);
            if (endMin > startMin) {
              bars.push({ left: (startMin / 1440) * 100, width: ((endMin - startMin) / 1440) * 100 });
            } else {
              bars.push({ left: (startMin / 1440) * 100, width: ((1440 - startMin) / 1440) * 100 });
              bars.push({ left: 0, width: (endMin / 1440) * 100 });
            }
          }

          return (
            <View key={app.name} style={styles.appRow}>
              <Text style={styles.appLabel} numberOfLines={1}>{app.name}</Text>
              <View style={styles.trackBg}>
                {/* Hour dividers */}
                {[6, 12, 18].map((h) => (
                  <View key={h} style={[styles.hourTick, { left: `${(h / 24) * 100}%` as any }]} />
                ))}
                {/* Block bars */}
                {bars.map((bar, i) => (
                  <View
                    key={i}
                    style={[styles.blockBar, { left: `${bar.left}%` as any, width: `${bar.width}%` as any, backgroundColor: color }]}
                  />
                ))}
                {/* Current time needle */}
                <View style={[styles.nowLine, { left: `${currentPct}%` as any }]} />
              </View>
            </View>
          );
        })
      )}

      {/* Legend */}
      {scheduledApps.length > 0 && (
        <View style={styles.legend}>
          {scheduledApps.map((app) => (
            <View key={app.name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colorMap[app.name] }]} />
              <Text style={styles.legendText}>{app.name}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Now</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── App Rule Editor ──────────────────────────────────────────────────────────

function AppRuleEditor({
  app,
  onClose,
}: {
  app: AppEntry;
  onClose: () => void;
}) {
  const colors = useColors();
  const { updateAppConfig, toggleAppBlocked, removeApp } = useUsage();
  const [cfg, setCfg] = useState<AppBlockConfig>({ ...app.blockConfig });

  function toggleTrigger(t: BlockTrigger) {
    Haptics.selectionAsync();
    setCfg((prev) => ({
      ...prev,
      triggers: prev.triggers.includes(t)
        ? prev.triggers.filter((x) => x !== t)
        : [...prev.triggers, t],
    }));
  }

  function save() {
    updateAppConfig(app.name, cfg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  const catColor = CATEGORIES.find((c) => c.key === app.category)?.color ?? "#666";
  const s = StyleSheet.create({
    wrap: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    headIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    headName: { flex: 1 },
    appName: { fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground },
    appCat: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
    body: { padding: 14, gap: 16 },
    groupTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 },
    triggerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    triggerChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    triggerChipActive: {},
    triggerChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    label: { fontFamily: "Inter_500Medium", fontSize: 14, color: colors.foreground },
    sub: { fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
    timeRow: { flexDirection: "row", gap: 10, marginTop: 4 },
    timeBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    timeBtnLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground },
    timeBtnValue: { fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground },
    daysRow: { flexDirection: "row", gap: 6, marginTop: 4 },
    dayBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.mutedForeground },
    dayBtnTextActive: { color: colors.primaryForeground },
    limitRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    limitBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    limitBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    limitBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground },
    limitBtnTextActive: { color: colors.primary },
    divider: { height: 1, backgroundColor: colors.border },
    actions: { flexDirection: "row", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: colors.border },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    cancelText: { fontFamily: "Inter_500Medium", fontSize: 14, color: colors.mutedForeground },
    saveBtn: { flex: 2, padding: 12, borderRadius: 10, alignItems: "center", backgroundColor: colors.primary },
    saveText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.primaryForeground },
  });

  const timeOptions = [
    ["05:00", "06:00", "07:00", "08:00"],
    ["09:00", "10:00", "11:00", "12:00"],
    ["13:00", "14:00", "16:00", "18:00"],
    ["19:00", "20:00", "21:00", "22:00"],
    ["23:00", "23:59"],
  ].flat();

  const limitOptions = [15, 30, 45, 60, 90, 120];

  const needsTime = cfg.triggers.includes("scheduled");
  const needsDays = cfg.triggers.some((t) => !["always", "scheduled", "sleep_hours", "usage_limit"].includes(t));
  const needsLimit = cfg.triggers.includes("usage_limit");

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.head}>
        <View style={[s.headIcon, { backgroundColor: catColor + "20" }]}>
          <Feather name="smartphone" size={16} color={catColor} />
        </View>
        <View style={s.headName}>
          <Text style={s.appName}>{app.name}</Text>
          <Text style={[s.appCat, { color: catColor }]}>{app.category}</Text>
        </View>
        <Switch
          value={app.blocked}
          disabled={app.blockConfig.permanent && app.blocked}
          onValueChange={() => toggleAppBlocked(app.name)}
          trackColor={{ false: colors.border, true: colors.destructive }}
          thumbColor={colors.foreground}
          ios_backgroundColor={colors.border}
        />
      </View>

      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <View style={s.body}>
          {/* Trigger groups */}
          {TRIGGER_GROUPS.map((group) => (
            <View key={group.label}>
              <Text style={s.groupTitle}>{group.label}</Text>
              <View style={s.triggerGrid}>
                {group.triggers.map((t) => {
                  const meta = TRIGGER_META[t];
                  const active = cfg.triggers.includes(t);
                  return (
                    <Pressable
                      key={t}
                      style={[s.triggerChip, active && { borderColor: meta.color, backgroundColor: meta.color + "20" }]}
                      onPress={() => toggleTrigger(t)}
                    >
                      <Feather name={meta.icon as any} size={12} color={active ? meta.color : colors.mutedForeground} />
                      <Text style={[s.triggerChipText, active && { color: meta.color }]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Time range (only if scheduled) */}
          {needsTime && (
            <View>
              <View style={s.divider} />
              <Text style={[s.groupTitle, { marginTop: 12 }]}>Time Window</Text>
              <View style={s.timeRow}>
                <View style={s.timeBtn}>
                  <Text style={s.timeBtnLabel}>Start</Text>
                  <Text style={s.timeBtnValue}>{cfg.startTime}</Text>
                </View>
                <View style={{ justifyContent: "center" }}>
                  <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                </View>
                <View style={s.timeBtn}>
                  <Text style={s.timeBtnLabel}>End</Text>
                  <Text style={s.timeBtnValue}>{cfg.endTime}</Text>
                </View>
              </View>
              <Text style={[s.sub, { marginTop: 8, marginBottom: 4 }]}>Start time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {timeOptions.map((t) => (
                  <Pressable
                    key={`start-${t}`}
                    style={[s.timeBtn, { paddingVertical: 6, paddingHorizontal: 10 }, cfg.startTime === t && { borderColor: colors.primary, backgroundColor: colors.primary + "18" }]}
                    onPress={() => setCfg((p) => ({ ...p, startTime: t }))}
                  >
                    <Text style={[s.timeBtnLabel, cfg.startTime === t && { color: colors.primary }]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={[s.sub, { marginTop: 8, marginBottom: 4 }]}>End time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {timeOptions.map((t) => (
                  <Pressable
                    key={`end-${t}`}
                    style={[s.timeBtn, { paddingVertical: 6, paddingHorizontal: 10 }, cfg.endTime === t && { borderColor: colors.primary, backgroundColor: colors.primary + "18" }]}
                    onPress={() => setCfg((p) => ({ ...p, endTime: t }))}
                  >
                    <Text style={[s.timeBtnLabel, cfg.endTime === t && { color: colors.primary }]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Day selector */}
          {needsDays && (
            <View>
              <View style={s.divider} />
              <Text style={[s.groupTitle, { marginTop: 12 }]}>Active Days</Text>
              <View style={s.daysRow}>
                {DAY_LABELS.map((label, i) => {
                  const active = cfg.days.includes(i);
                  return (
                    <Pressable
                      key={i}
                      style={[s.dayBtn, active && s.dayBtnActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCfg((p) => ({
                          ...p,
                          days: active ? p.days.filter((d) => d !== i) : [...p.days, i],
                        }));
                      }}
                    >
                      <Text style={[s.dayBtnText, active && s.dayBtnTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {[
                  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
                  { label: "Weekends", days: [0, 6] },
                  { label: "All", days: [0, 1, 2, 3, 4, 5, 6] },
                ].map((preset) => (
                  <Pressable
                    key={preset.label}
                    style={[s.limitBtn]}
                    onPress={() => { Haptics.selectionAsync(); setCfg((p) => ({ ...p, days: preset.days })); }}
                  >
                    <Text style={s.limitBtnText}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Usage limit */}
          {needsLimit && (
            <View>
              <View style={s.divider} />
              <Text style={[s.groupTitle, { marginTop: 12 }]}>Daily Limit</Text>
              <View style={s.limitRow}>
                {limitOptions.map((m) => (
                  <Pressable
                    key={m}
                    style={[s.limitBtn, cfg.dailyLimitMin === m && s.limitBtnActive]}
                    onPress={() => { Haptics.selectionAsync(); setCfg((p) => ({ ...p, dailyLimitMin: m })); }}
                  >
                    <Text style={[s.limitBtnText, cfg.dailyLimitMin === m && s.limitBtnTextActive]}>
                      {m < 60 ? `${m}m` : `${m / 60}h`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Options */}
          <View style={s.divider} />
          <View style={{ gap: 10, marginTop: 4 }}>
            <View style={s.row}>
              <View>
                <Text style={s.label}>Permanent Block</Text>
                <Text style={s.sub}>Cannot be unblocked manually</Text>
              </View>
              <Switch
                value={cfg.permanent}
                onValueChange={(v) => { Haptics.selectionAsync(); setCfg((p) => ({ ...p, permanent: v })); }}
                trackColor={{ false: colors.border, true: colors.destructive }}
                thumbColor={colors.foreground}
                ios_backgroundColor={colors.border}
              />
            </View>
            <View style={s.row}>
              <View>
                <Text style={s.label}>Emergency Access</Text>
                <Text style={s.sub}>Allow with emergency unlock cooldown</Text>
              </View>
              <Switch
                value={cfg.emergencyAllowed}
                onValueChange={(v) => { Haptics.selectionAsync(); setCfg((p) => ({ ...p, emergencyAllowed: v })); }}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.foreground}
                ios_backgroundColor={colors.border}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={s.actions}>
        <Pressable style={s.cancelBtn} onPress={onClose}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={s.saveBtn} onPress={save}>
          <Text style={s.saveText}>Save Rules</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BlockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    apps, blockRules, whitelist,
    toggleAppBlocked, addApp, removeApp,
    addBlockRule, removeBlockRule, toggleBlockRule,
    addToWhitelist, removeFromWhitelist,
    lockModeEnabled, strictModeEnabled, setLockMode, setStrictMode,
    emergencyUnlock, triggerEmergencyUnlock,
    blockedApps, categoryColors, disciplineScore,
    strictReliability,
    defaultBlockConfig,
  } = useUsage();

  const [activeTab, setActiveTab] = useState<Tab>("apps");
  const [filterCat, setFilterCat] = useState<AppCategory | "all">("all");
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [ruleInput, setRuleInput] = useState("");
  const [ruleType, setRuleType] = useState<"website" | "keyword">("website");
  const [addAppInput, setAddAppInput] = useState("");
  const [lowPowerMode, setLowPowerMode] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const styles = makeStyles(colors);

  const filteredApps = useMemo(() => {
    let list = filterCat === "all" ? apps : apps.filter((a) => a.category === filterCat);
    if (searchText) list = list.filter((a) => a.name.toLowerCase().includes(searchText.toLowerCase()));
    return list;
  }, [apps, filterCat, searchText]);

  const cooldownMs = emergencyUnlock
    ? Math.max(0, emergencyUnlock.cooldownMs - (Date.now() - emergencyUnlock.unlockedAt))
    : 0;

  useEffect(() => {
    let mounted = true;
    Battery.isLowPowerModeEnabledAsync().then((enabled) => {
      if (mounted) setLowPowerMode(enabled);
    }).catch(() => {});
    const sub = Battery.addLowPowerModeListener(({ lowPowerMode: enabled }) => {
      setLowPowerMode(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  function handleStrictMode(v: boolean) {
    if (v) {
      Alert.alert(
        "Activate Strict Mode?",
        "• Focus overlay locked\n• Back button bypass disabled\n• Session survives app reopen\n• Emergency unlock: 30-min cooldown\n\nNative device-wide app blocking still requires the Android blocker module in production builds.",
        [
          { text: "Not yet", style: "cancel" },
          { text: "Lock it down", style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setStrictMode(true); } },
        ]
      );
    } else {
      if (strictModeEnabled) {
        Alert.alert("Disable Strict Mode?", "You are ending your strict focus session early. Continue?", [
          { text: "Stay focused", style: "cancel" },
          { text: "Disable", onPress: () => setStrictMode(false) },
        ]);
      } else {
        setStrictMode(false);
      }
    }
  }

  function handleEmergencyUnlock() {
    if (cooldownMs > 0) {
      Alert.alert("Cooldown Active", `Emergency unlock available in ${Math.ceil(cooldownMs / 60000)} minutes.`);
      return;
    }
    Alert.alert(
      "Emergency Unlock",
      "This will temporarily lift all blocks. A 30-minute cooldown will prevent repeated use. Only use in genuine emergencies.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unlock", style: "destructive", onPress: () => { triggerEmergencyUnlock(); Alert.alert("Unlocked", "All blocks lifted temporarily. Cooldown: 30 min."); } },
      ]
    );
  }

  function handleAddApp() {
    const name = addAppInput.trim();
    if (!name) return;
    addApp({ name, category: "other", blocked: true, blockConfig: { ...defaultBlockConfig(), triggers: ["always"] } });
    setAddAppInput("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.container]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={styles.headerTitle}>Block Center</Text>
          <Text style={styles.headerSub}>{blockedApps.length} apps blocked · discipline {disciplineScore}</Text>
        </View>
        <Pressable
          style={[styles.lockBtn, lockModeEnabled && styles.lockBtnActive]}
          onPress={() => { Haptics.selectionAsync(); setLockMode(!lockModeEnabled); }}
        >
          <Feather name={lockModeEnabled ? "lock" : "unlock"} size={14} color={lockModeEnabled ? colors.destructive : colors.mutedForeground} />
          <Text style={[styles.lockBtnText, lockModeEnabled && { color: colors.destructive }]}>
            {lockModeEnabled ? "Locked" : "Lock"}
          </Text>
        </Pressable>
      </View>

      {/* Strict Mode Banner */}
      <Pressable
        style={[styles.strictBanner, strictModeEnabled && styles.strictBannerActive]}
        onPress={() => handleStrictMode(!strictModeEnabled)}
      >
        <View style={[styles.strictIcon, { backgroundColor: strictModeEnabled ? colors.destructive + "20" : colors.card }]}>
          <Feather name="shield" size={16} color={strictModeEnabled ? colors.destructive : colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.strictTitle, strictModeEnabled && { color: colors.destructive }]}>
            Strict Mode {strictModeEnabled ? "ACTIVE" : ""}
          </Text>
          <Text style={styles.strictSub}>
            {strictModeEnabled
              ? "Lockdown active. No bypasses. Only whitelist apps accessible."
              : "Tap to activate focus lockdown"}
          </Text>
        </View>
        <View style={[styles.strictToggleDot, { backgroundColor: strictModeEnabled ? colors.destructive : colors.border }]} />
      </Pressable>

      {/* Emergency unlock */}
      {strictModeEnabled && (
        <Pressable
          style={({ pressed }) => [styles.emergencyRow, pressed && { opacity: 0.8 }]}
          onPress={handleEmergencyUnlock}
        >
          <Feather name="alert-triangle" size={13} color={cooldownMs > 0 ? colors.mutedForeground : colors.warning} />
          <Text style={[styles.emergencyText, cooldownMs > 0 && { color: colors.mutedForeground }]}>
            {cooldownMs > 0 ? `Emergency unlock — cooldown ${Math.ceil(cooldownMs / 60000)}m remaining` : "Emergency Unlock (30-min cooldown applies)"}
          </Text>
        </Pressable>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["apps", "schedule", "reels", "strict", "rules"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(t); setExpandedApp(null); }}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "apps" ? "Apps" : t === "schedule" ? "Timeline" : t === "reels" ? "Reels" : t === "strict" ? "Strict" : "Rules"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── APPS TAB ── */}
        {activeTab === "apps" && (
          <View style={styles.tabContent}>
            {/* Search */}
            <View style={styles.searchRow}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search apps..."
                placeholderTextColor={colors.mutedForeground}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText !== "" && (
                <Pressable onPress={() => setSearchText("")}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
              <Pressable style={[styles.catChip, filterCat === "all" && styles.catChipActive]} onPress={() => setFilterCat("all")}>
                <Text style={[styles.catChipText, filterCat === "all" && { color: colors.primary }]}>All ({apps.length})</Text>
              </Pressable>
              {CATEGORIES.map((cat) => {
                const count = apps.filter((a) => a.category === cat.key).length;
                return (
                  <Pressable
                    key={cat.key}
                    style={[styles.catChip, filterCat === cat.key && { borderColor: cat.color, backgroundColor: cat.color + "18" }]}
                    onPress={() => setFilterCat(cat.key)}
                  >
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.catChipText, filterCat === cat.key && { color: cat.color }]}>{cat.label} ({count})</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Add app */}
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add app name..."
                placeholderTextColor={colors.mutedForeground}
                value={addAppInput}
                onChangeText={setAddAppInput}
                onSubmitEditing={handleAddApp}
                returnKeyType="done"
              />
              <Pressable style={styles.addBtn} onPress={handleAddApp}>
                <Feather name="plus" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>

            {/* App list */}
            {filteredApps.map((app) => {
              const catColor = categoryColors[app.category];
              const isExpanded = expandedApp === app.name;
              const primaryLabel = getPrimaryTriggerLabel(app.blockConfig);

              return (
                <View key={app.name} style={styles.appCard}>
                  {/* App row */}
                  <Pressable
                    style={styles.appRow}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setExpandedApp(isExpanded ? null : app.name);
                    }}
                  >
                    <View style={[styles.appCatBar, { backgroundColor: catColor }]} />
                    <View style={[styles.appIcon, { backgroundColor: catColor + "20" }]}>
                      <Feather name="smartphone" size={14} color={catColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.appName}>{app.name}</Text>
                      <View style={styles.appTagRow}>
                        <View style={[styles.triggerBadge, { backgroundColor: primaryLabel.color + "22" }]}>
                          <Text style={[styles.triggerBadgeText, { color: primaryLabel.color }]}>{primaryLabel.label}</Text>
                        </View>
                        {app.blockConfig.triggers.length > 1 && (
                          <Text style={styles.moreTriggersText}>+{app.blockConfig.triggers.length - 1} more</Text>
                        )}
                      </View>
                    </View>
                    <Switch
                      value={app.blocked}
                      disabled={app.blockConfig.permanent && app.blocked}
                      onValueChange={() => { Haptics.selectionAsync(); toggleAppBlocked(app.name); }}
                      trackColor={{ false: colors.border, true: colors.destructive }}
                      thumbColor={colors.foreground}
                      ios_backgroundColor={colors.border}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <Feather name={isExpanded ? "chevron-up" : "settings"} size={14} color={colors.mutedForeground} />
                  </Pressable>

                  {/* Inline rule editor */}
                  {isExpanded && (
                    <View style={styles.editorWrap}>
                      <AppRuleEditor
                        app={app}
                        onClose={() => setExpandedApp(null)}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── SCHEDULE / TIMELINE TAB ── */}
        {activeTab === "schedule" && (
          <View style={styles.tabContent}>
            <View style={styles.infoBox}>
              <Feather name="info" size={13} color={colors.primary} />
              <Text style={styles.infoBoxText}>
                24-hour timeline shows when each app is blocked today. The blue line marks the current time.
              </Text>
            </View>
            <View style={[styles.card, { paddingVertical: 16 }]}>
              <ScheduleTimeline apps={apps} />
            </View>

            {/* Summary cards */}
            <Text style={styles.sectionTitle}>Today's Blocks</Text>
            {apps.filter((a) => a.blocked && a.blockConfig.triggers.length > 0).map((app) => {
              const catColor = categoryColors[app.category];
              const label = getPrimaryTriggerLabel(app.blockConfig);
              return (
                <View key={app.name} style={styles.scheduleRow}>
                  <View style={[styles.scheduleRowBar, { backgroundColor: label.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scheduleRowName}>{app.name}</Text>
                    <Text style={[styles.scheduleRowTrigger, { color: label.color }]}>
                      {app.blockConfig.triggers.map((t) => TRIGGER_META[t].label).join(" · ")}
                    </Text>
                  </View>
                  {app.blockConfig.triggers.includes("scheduled") && (
                    <Text style={styles.scheduleRowTime}>
                      {app.blockConfig.startTime} – {app.blockConfig.endTime}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── REELS / SHORTS TAB ── */}
        {activeTab === "reels" && <ReelsTab colors={colors} styles={styles} />}

        {/* ── STRICT TAB ── */}
        {activeTab === "strict" && (
          <View style={styles.tabContent}>
            {(lowPowerMode || strictReliability.interruptionCount > 0) && (
              <View style={[styles.infoBox, { borderColor: colors.warning + "55", backgroundColor: colors.warning + "10" }]}>
                <Feather name="alert-triangle" size={13} color={colors.warning} />
                <Text style={styles.infoBoxText}>
                  {lowPowerMode
                    ? "Battery Saver is ON. Android may pause strict-mode protection in background."
                    : `Detected ${strictReliability.interruptionCount} background interruption${strictReliability.interruptionCount > 1 ? "s" : ""} during strict mode.`}
                </Text>
              </View>
            )}

            {(lowPowerMode || strictReliability.interruptionCount > 0) && (
              <Pressable
                style={[styles.emergencyRow, { borderColor: colors.warning + "44" }]}
                onPress={() => Linking.openSettings()}
              >
                <Feather name="settings" size={13} color={colors.warning} />
                <Text style={[styles.emergencyText, { color: colors.warning }]}>
                  Open Settings to disable battery restrictions for Focus Shield
                </Text>
              </Pressable>
            )}

            {/* Strict mode detail */}
            <View style={[styles.card, { padding: 16, gap: 16 }]}>
              <View style={styles.strictDetailRow}>
                <View style={[styles.strictDetailIcon, { backgroundColor: strictModeEnabled ? colors.destructive + "20" : colors.border }]}>
                  <Feather name="shield" size={20} color={strictModeEnabled ? colors.destructive : colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Strict Mode</Text>
                  <Text style={styles.sub}>Focus overlay, back-button lock, and session recovery.</Text>
                </View>
                <Switch
                  value={strictModeEnabled}
                  onValueChange={handleStrictMode}
                  trackColor={{ false: colors.border, true: colors.destructive }}
                  thumbColor={colors.foreground}
                  ios_backgroundColor={colors.border}
                />
              </View>

              <View style={styles.divider} />

              {[
                { label: "Overlay locked", icon: "eye-off", desc: "Strict screen covers the app during active sessions" },
                { label: "Back button locked", icon: "arrow-left-circle", desc: "Android back cannot dismiss the strict overlay" },
                { label: "Native blocker required", icon: "layers", desc: "Device-wide app interception needs the Android service module" },
                { label: "Bypass attempts logged", icon: "zap", desc: "Back-button attempts increment strict-mode telemetry" },
                { label: "Session survives reopen", icon: "refresh-cw", desc: "Closing and reopening app maintains lockdown" },
              ].map((item, i) => (
                <View key={i} style={styles.strictFeatureRow}>
                  <View style={[styles.strictFeatureIcon, { backgroundColor: strictModeEnabled ? colors.primary + "18" : colors.border }]}>
                    <Feather name={item.icon as any} size={14} color={strictModeEnabled ? colors.primary : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.strictFeatureLabel, !strictModeEnabled && { color: colors.mutedForeground }]}>{item.label}</Text>
                    <Text style={styles.sub}>{item.desc}</Text>
                  </View>
                  {strictModeEnabled && <Feather name="check" size={14} color={colors.success} />}
                </View>
              ))}
            </View>

            {/* Whitelist */}
            <Text style={styles.sectionTitle}>Whitelist Apps</Text>
            <View style={styles.infoBox}>
              <Feather name="check-circle" size={13} color={colors.success} />
              <Text style={styles.infoBoxText}>
                Whitelist is used by the strict-mode UI today. Device-wide enforcement requires the native Android blocker module.
              </Text>
            </View>
            <View style={styles.whitelistGrid}>
              {WHITELIST_PRESETS.map((p) => {
                const added = whitelist.some((w) => w.name === p.name);
                return (
                  <Pressable
                    key={p.name}
                    style={[styles.whitelistChip, added && styles.whitelistChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      added ? removeFromWhitelist(p.name) : addToWhitelist(p);
                    }}
                  >
                    <Feather name={p.icon as any} size={15} color={added ? colors.success : colors.mutedForeground} />
                    <Text style={[styles.whitelistChipText, added && { color: colors.success }]}>{p.name}</Text>
                    {added && <Feather name="check" size={10} color={colors.success} />}
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Whitelisted ({whitelist.length})</Text>
            <View style={{ gap: 8 }}>
              {whitelist.map((w) => (
                <View key={w.name} style={styles.whitelistRow}>
                  <View style={styles.whitelistRowIcon}>
                    <Feather name={w.icon as any} size={15} color={colors.success} />
                  </View>
                  <Text style={styles.whitelistRowName}>{w.name}</Text>
                  <Pressable hitSlop={12} onPress={() => removeFromWhitelist(w.name)}>
                    <Feather name="x" size={15} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── RULES TAB ── */}
        {activeTab === "rules" && (
          <View style={styles.tabContent}>
            <View style={styles.infoBox}>
              <Feather name="globe" size={13} color={colors.primary} />
              <Text style={styles.infoBoxText}>Block websites and keywords across all browsers and apps during active sessions.</Text>
            </View>

            <View style={styles.ruleTypeRow}>
              {(["website", "keyword"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.ruleTypeBtn, ruleType === t && styles.ruleTypeBtnActive]}
                  onPress={() => setRuleType(t)}
                >
                  <Feather name={t === "website" ? "globe" : "hash"} size={13} color={ruleType === t ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.ruleTypeBtnText, ruleType === t && { color: colors.primary }]}>
                    {t === "website" ? "Website" : "Keyword"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={ruleType === "website" ? "e.g. reddit.com" : "e.g. shorts"}
                placeholderTextColor={colors.mutedForeground}
                value={ruleInput}
                onChangeText={setRuleInput}
                onSubmitEditing={() => {
                  if (!ruleInput.trim()) return;
                  addBlockRule({ type: ruleType, value: ruleInput.trim(), enabled: true });
                  setRuleInput("");
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                returnKeyType="done"
                autoCapitalize="none"
              />
              <Pressable
                style={styles.addBtn}
                onPress={() => {
                  if (!ruleInput.trim()) return;
                  addBlockRule({ type: ruleType, value: ruleInput.trim(), enabled: true });
                  setRuleInput("");
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Feather name="plus" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>

            {/* Presets */}
            <Text style={styles.sectionTitle}>Common Blocks</Text>
            <View style={styles.presetRow}>
              {["youtube.com", "reddit.com", "twitter.com", "instagram.com", "tiktok.com", "netflix.com"].map((site) => (
                <Pressable
                  key={site}
                  style={({ pressed }) => [styles.presetChip, pressed && { opacity: 0.7 }, blockRules.some((r) => r.value === site) && { borderColor: colors.destructive, backgroundColor: colors.destructive + "12" }]}
                  onPress={() => {
                    if (blockRules.some((r) => r.value === site)) return;
                    addBlockRule({ type: "website", value: site, enabled: true });
                    Haptics.selectionAsync();
                  }}
                >
                  <Feather name="globe" size={11} color={blockRules.some((r) => r.value === site) ? colors.destructive : colors.mutedForeground} />
                  <Text style={[styles.presetChipText, blockRules.some((r) => r.value === site) && { color: colors.destructive }]}>{site}</Text>
                </Pressable>
              ))}
            </View>

            {blockRules.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="slash" size={26} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No rules yet</Text>
                <Text style={styles.emptySub}>Add websites or keywords to block them</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {blockRules.map((rule) => (
                  <View key={rule.id} style={styles.ruleRow}>
                    <View style={[styles.ruleIcon, { backgroundColor: colors.primary + "18" }]}>
                      <Feather name={rule.type === "website" ? "globe" : "hash"} size={13} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ruleValue}>{rule.value}</Text>
                      <Text style={styles.ruleType}>{rule.type}</Text>
                    </View>
                    <Switch
                      value={rule.enabled}
                      onValueChange={() => toggleBlockRule(rule.id)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.foreground}
                      ios_backgroundColor={colors.border}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <Pressable hitSlop={10} onPress={() => removeBlockRule(rule.id)}>
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Reels Tab ────────────────────────────────────────────────────────────────

const REELS_PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram",
    icon: "camera" as const,
    color: "#ec4899",
    features: [
      { key: "reels", label: "Block Reels feed" },
      { key: "stories", label: "Block Stories autoplay" },
      { key: "explore", label: "Block Explore tab" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "play-circle" as const,
    color: "#ef4444",
    features: [
      { key: "shorts", label: "Block Shorts tab" },
      { key: "autoplay", label: "Block video autoplay" },
      { key: "recommendations", label: "Block homepage feed" },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "music" as const,
    color: "#38bdf8",
    features: [
      { key: "foryou", label: "Block For You feed" },
      { key: "following", label: "Block Following tab" },
      { key: "live", label: "Block LIVE section" },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "users" as const,
    color: "#6366f1",
    features: [
      { key: "reels", label: "Block Facebook Reels" },
      { key: "feed", label: "Block infinite news feed" },
    ],
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: "twitter" as const,
    color: "#4e6880",
    features: [
      { key: "trending", label: "Block Trending / Explore" },
      { key: "foryou", label: "Block For You timeline" },
    ],
  },
  {
    id: "snapchat",
    name: "Snapchat",
    icon: "camera-off" as const,
    color: "#f59e0b",
    features: [
      { key: "discover", label: "Block Discover feed" },
      { key: "spotlight", label: "Block Spotlight (Shorts clone)" },
    ],
  },
];

function ReelsTab({ colors, styles }: { colors: ReturnType<typeof useColors>; styles: ReturnType<typeof makeStyles> }) {
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [globalAutoplay, setGlobalAutoplay] = useState(true);
  const [globalScroll, setGlobalScroll] = useState(false);
  const [grayscale, setGrayscale] = useState(false);
  const [dopamineDelay, setDopamineDelay] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("fs_reels_v1");
        if (raw) {
          const d = JSON.parse(raw);
          if (d.blocked) setBlocked(d.blocked);
          if (typeof d.globalAutoplay === "boolean") setGlobalAutoplay(d.globalAutoplay);
          if (typeof d.globalScroll === "boolean") setGlobalScroll(d.globalScroll);
          if (typeof d.grayscale === "boolean") setGrayscale(d.grayscale);
          if (typeof d.dopamineDelay === "number") setDopamineDelay(d.dopamineDelay);
        }
      } catch {}
    })();
  }, []);

  const toggle = useCallback((key: string, value: boolean) => {
    Haptics.selectionAsync();
    const next = { ...blocked, [key]: value };
    setBlocked(next);
    try {
      AsyncStorage.setItem("fs_reels_v1", JSON.stringify({ blocked: next, globalAutoplay, globalScroll, grayscale, dopamineDelay }));
    } catch {}
  }, [blocked, globalAutoplay, globalScroll, grayscale, dopamineDelay]);

  const blockedCount = Object.values(blocked).filter(Boolean).length;

  return (
    <View style={styles.tabContent}>
      {/* Header info */}
      <View style={[styles.infoBox, { backgroundColor: colors.neon + "0A", borderColor: colors.neon + "33" }]}>
        <Feather name="eye-off" size={13} color={colors.neon} />
        <Text style={[styles.infoBoxText, { color: colors.mutedForeground }]}>
          Block addictive short-form content while allowing normal app usage. {blockedCount > 0 ? `${blockedCount} features blocked.` : ""}
        </Text>
      </View>

      {/* Per-platform cards */}
      {REELS_PLATFORMS.map((platform) => {
        const allOn = platform.features.every((f) => blocked[`${platform.id}_${f.key}`]);
        return (
          <View key={platform.id} style={[styles.card, { padding: 14, gap: 0 }]}>
            {/* Platform header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={[{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" }, { backgroundColor: platform.color + "20" }]}>
                <Feather name={platform.icon} size={17} color={platform.color} />
              </View>
              <Text style={[styles.label, { flex: 1 }]}>{platform.name}</Text>
              <Pressable
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                onPress={() => {
                  Haptics.selectionAsync();
                  const newVal = !allOn;
                  const next = { ...blocked };
                  platform.features.forEach((f) => { next[`${platform.id}_${f.key}`] = newVal; });
                  setBlocked(next);
                  try { AsyncStorage.setItem("fs_reels_v1", JSON.stringify({ blocked: next, globalAutoplay, globalScroll, grayscale, dopamineDelay })); } catch {}
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: allOn ? platform.color : colors.mutedForeground }}>
                  {allOn ? "All On" : "Block All"}
                </Text>
              </Pressable>
            </View>

            {/* Features */}
            {platform.features.map((feature, fi) => {
              const key = `${platform.id}_${feature.key}`;
              return (
                <View key={feature.key}>
                  {fi > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{feature.label}</Text>
                    </View>
                    <Switch
                      value={blocked[key] ?? false}
                      onValueChange={(v) => toggle(key, v)}
                      trackColor={{ false: colors.border, true: platform.color }}
                      thumbColor={colors.foreground}
                      ios_backgroundColor={colors.border}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}

      {/* Global Controls */}
      <Text style={styles.sectionLabel}>Global Controls</Text>
      <View style={[styles.card, { padding: 16, gap: 14 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>Block Autoplay Videos</Text>
            <Text style={styles.sub}>Prevent videos from playing automatically</Text>
          </View>
          <Switch
            value={globalAutoplay}
            onValueChange={(v) => { Haptics.selectionAsync(); setGlobalAutoplay(v); }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.foreground}
            ios_backgroundColor={colors.border}
          />
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>Disable Infinite Scroll</Text>
            <Text style={styles.sub}>Show a pause after every 10 items</Text>
          </View>
          <Switch
            value={globalScroll}
            onValueChange={(v) => { Haptics.selectionAsync(); setGlobalScroll(v); }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.foreground}
            ios_backgroundColor={colors.border}
          />
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>Grayscale During Sessions</Text>
            <Text style={styles.sub}>Reduce visual stimulation while focused</Text>
          </View>
          <Switch
            value={grayscale}
            onValueChange={(v) => { Haptics.selectionAsync(); setGrayscale(v); }}
            trackColor={{ false: colors.border, true: colors.neonPurple }}
            thumbColor={colors.foreground}
            ios_backgroundColor={colors.border}
          />
        </View>
      </View>

      {/* Dopamine Control */}
      <Text style={styles.sectionLabel}>Dopamine Delay</Text>
      <View style={[styles.card, { padding: 16, gap: 10 }]}>
        <Text style={styles.sub}>Add a mindful pause before opening social apps. Forces a moment of intention.</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {[0, 5, 10, 15, 30, 60].map((sec) => (
            <Pressable
              key={sec}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: dopamineDelay === sec ? colors.neon + "18" : colors.surface,
                borderWidth: 1, borderColor: dopamineDelay === sec ? colors.neon : colors.border,
              }}
              onPress={() => { Haptics.selectionAsync(); setDopamineDelay(sec); }}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: dopamineDelay === sec ? colors.neon : colors.mutedForeground }}>
                {sec === 0 ? "Off" : `${sec}s`}
              </Text>
            </Pressable>
          ))}
        </View>
        {dopamineDelay > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.neon + "0C", borderRadius: 8, padding: 10 }}>
            <Feather name="info" size={12} color={colors.neon} />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, flex: 1 }}>
              A {dopamineDelay}s breathing screen will appear before opening blocked social apps.
            </Text>
          </View>
        )}
      </View>

      {/* Note */}
      <View style={[styles.infoBox, { marginTop: 4 }]}>
        <Feather name="info" size={13} color={colors.mutedForeground} />
        <Text style={styles.infoBoxText}>
          Full content-level blocking (e.g. hiding only the Shorts tab) requires the Android Accessibility Service. These settings log your blocking preferences and activate with the native module.
        </Text>
      </View>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: c.foreground, letterSpacing: -0.6 },
    headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 },
    lockBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: c.border },
    lockBtnActive: { borderColor: c.destructive + "55", backgroundColor: c.destructive + "10" },
    lockBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
    strictBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginBottom: 6, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
    strictBannerActive: { borderColor: c.destructive + "66", backgroundColor: c.destructive + "08" },
    strictIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    strictTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground },
    strictSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 1, lineHeight: 15 },
    strictToggleDot: { width: 10, height: 10, borderRadius: 5 },
    emergencyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginBottom: 6, backgroundColor: c.warning + "14", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: c.warning + "33" },
    emergencyText: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.warning, flex: 1 },
    tabs: { flexDirection: "row", marginHorizontal: 20, marginBottom: 6, backgroundColor: c.card, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: c.border },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
    tabActive: { backgroundColor: c.primary },
    tabText: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
    tabTextActive: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
    tabContent: { paddingHorizontal: 20, gap: 10, paddingTop: 4 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 10 },
    searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: c.foreground },
    catChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    catChipActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    catChipText: { fontFamily: "Inter_500Medium", fontSize: 11, color: c.mutedForeground },
    catDot: { width: 6, height: 6, borderRadius: 3 },
    addRow: { flexDirection: "row", gap: 8 },
    input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontFamily: "Inter_400Regular", fontSize: 14, color: c.foreground },
    addBtn: { backgroundColor: c.primary, borderRadius: 12, width: 46, alignItems: "center", justifyContent: "center" },
    appCard: { borderRadius: 12, overflow: "hidden", backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    appRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 12 },
    appCatBar: { width: 3, alignSelf: "stretch" },
    appIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginVertical: 10, marginLeft: 8 },
    appName: { fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    appTagRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    triggerBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    triggerBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
    moreTriggersText: { fontFamily: "Inter_400Regular", fontSize: 10, color: c.mutedForeground },
    editorWrap: { borderTopWidth: 1, borderTopColor: c.border },
    card: { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
    infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
    infoBoxText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, lineHeight: 18 },
    sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: c.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
    scheduleRow: { flexDirection: "row", alignItems: "center", gap: 0, backgroundColor: c.card, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    scheduleRowBar: { width: 3, alignSelf: "stretch" },
    scheduleRowName: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground, paddingLeft: 10, paddingTop: 10 },
    scheduleRowTrigger: { fontFamily: "Inter_400Regular", fontSize: 11, paddingLeft: 10, paddingBottom: 10, marginTop: 2 },
    scheduleRowTime: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.mutedForeground, paddingRight: 12 },
    strictDetailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    strictDetailIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    label: { fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    sub: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 1 },
    divider: { height: 1, backgroundColor: c.border },
    strictFeatureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    strictFeatureIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    strictFeatureLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground },
    whitelistGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    whitelistChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.card, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border },
    whitelistChipActive: { borderColor: c.success, backgroundColor: c.success + "14" },
    whitelistChipText: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground },
    whitelistRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.success + "44" },
    whitelistRowIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.success + "20", alignItems: "center", justifyContent: "center" },
    whitelistRowName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    ruleTypeRow: { flexDirection: "row", gap: 8 },
    ruleTypeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    ruleTypeBtnActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    ruleTypeBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.mutedForeground },
    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    presetChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    presetChipText: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground },
    empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
    emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground },
    emptySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center" },
    ruleRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
    ruleIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    ruleValue: { fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    ruleType: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, textTransform: "capitalize", marginTop: 1 },
    sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: c.mutedForeground, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 4, marginBottom: 6 },
  });
}
