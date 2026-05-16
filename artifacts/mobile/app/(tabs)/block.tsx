import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
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
import { AppCategory, AppEntry, useUsage } from "@/context/UsageContext";

type Tab = "apps" | "whitelist" | "rules" | "schedule";

const CATEGORIES: { key: AppCategory; label: string; color: string }[] = [
  { key: "social", label: "Social", color: "#f43f5e" },
  { key: "entertainment", label: "Entertainment", color: "#f59e0b" },
  { key: "gaming", label: "Gaming", color: "#a855f7" },
  { key: "communication", label: "Communication", color: "#38bdf8" },
  { key: "productive", label: "Productive", color: "#22c55e" },
  { key: "news", label: "News", color: "#64748b" },
  { key: "other", label: "Other", color: "#475569" },
];

const WHITELIST_PRESETS = [
  { name: "Phone", icon: "phone" },
  { name: "Messages", icon: "message-circle" },
  { name: "Calculator", icon: "hash" },
  { name: "Notes", icon: "file-text" },
  { name: "Maps", icon: "map-pin" },
  { name: "Camera", icon: "camera" },
  { name: "Email", icon: "mail" },
  { name: "Calendar", icon: "calendar" },
];

const RULE_TYPES = [
  { key: "app" as const, label: "App Name", icon: "smartphone", placeholder: "e.g. Instagram" },
  { key: "website" as const, label: "Website", icon: "globe", placeholder: "e.g. reddit.com" },
  { key: "keyword" as const, label: "Keyword", icon: "hash", placeholder: "e.g. YouTube" },
];

export default function BlockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    apps, blockRules, toggleAppBlocked, addApp, removeApp, setAppLimit,
    addBlockRule, removeBlockRule, toggleBlockRule,
    lockModeEnabled, strictModeEnabled, setLockMode, setStrictMode,
    emergencyUnlock, triggerEmergencyUnlock,
  } = useUsage();

  const [activeTab, setActiveTab] = useState<Tab>("apps");
  const [filterCat, setFilterCat] = useState<AppCategory | "all">("all");
  const [addInput, setAddInput] = useState("");
  const [addCat, setAddCat] = useState<AppCategory>("social");
  const [ruleInput, setRuleInput] = useState("");
  const [ruleType, setRuleType] = useState<"app" | "website" | "keyword">("app");
  const [whitelistApps, setWhitelistApps] = useState<string[]>(["Phone", "Messages", "Calculator"]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const styles = makeStyles(colors);

  const filteredApps = filterCat === "all"
    ? apps
    : apps.filter((a) => a.category === filterCat);

  const blockedCount = apps.filter((a) => a.blocked).length;

  const cooldownRemaining = emergencyUnlock
    ? Math.max(0, emergencyUnlock.cooldownMs - (Date.now() - emergencyUnlock.unlockedAt))
    : 0;

  function handleAddApp() {
    const name = addInput.trim();
    if (!name) return;
    addApp({ name, category: addCat, blocked: true });
    setAddInput("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleAddRule() {
    const val = ruleInput.trim();
    if (!val) return;
    addBlockRule({ type: ruleType, value: val, enabled: true });
    setRuleInput("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleStrictMode(v: boolean) {
    if (v) {
      Alert.alert(
        "Enable Strict Mode?",
        "All blocked apps will be permanently locked until the session ends. Emergency unlock has a 30-minute cooldown. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Activate",
            style: "destructive",
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setStrictMode(true);
            },
          },
        ]
      );
    } else {
      setStrictMode(false);
    }
  }

  function handleEmergencyUnlock() {
    const success = triggerEmergencyUnlock();
    if (!success) {
      const mins = Math.ceil(cooldownRemaining / 60000);
      Alert.alert("Cooldown Active", `Emergency unlock is on cooldown. Try again in ${mins} minutes.`);
    } else {
      Alert.alert("Unlocked", "Emergency unlock granted. All blocks lifted for 1 minute. Cooldown: 30 min.");
    }
  }

  function toggleWhitelist(name: string) {
    Haptics.selectionAsync();
    setWhitelistApps((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={styles.headerTitle}>Block Center</Text>
          <Text style={styles.headerSub}>{blockedCount} apps blocked</Text>
        </View>
        {/* Lock Mode toggle */}
        <View style={styles.lockToggle}>
          <Feather name="lock" size={14} color={lockModeEnabled ? colors.destructive : colors.mutedForeground} />
          <Switch
            value={lockModeEnabled}
            onValueChange={(v) => { Haptics.selectionAsync(); setLockMode(v); }}
            trackColor={{ false: colors.border, true: colors.destructive + "99" }}
            thumbColor={lockModeEnabled ? colors.destructive : colors.foreground}
            ios_backgroundColor={colors.border}
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
        </View>
      </View>

      {/* Strict Mode Banner */}
      <View style={[styles.strictBanner, strictModeEnabled && styles.strictBannerActive]}>
        <View style={styles.strictBannerLeft}>
          <Feather name="shield" size={18} color={strictModeEnabled ? colors.destructive : colors.mutedForeground} />
          <View>
            <Text style={[styles.strictBannerTitle, strictModeEnabled && { color: colors.destructive }]}>
              Strict Mode {strictModeEnabled ? "ACTIVE" : "Off"}
            </Text>
            <Text style={styles.strictBannerSub}>
              {strictModeEnabled
                ? "All blocked apps locked. No bypass possible."
                : "Enable for unbreakable focus lockdown"}
            </Text>
          </View>
        </View>
        <Switch
          value={strictModeEnabled}
          onValueChange={handleStrictMode}
          trackColor={{ false: colors.border, true: colors.destructive }}
          thumbColor={colors.foreground}
          ios_backgroundColor={colors.border}
        />
      </View>

      {/* Emergency Unlock */}
      {strictModeEnabled && (
        <Pressable
          style={({ pressed }) => [styles.emergencyBtn, pressed && { opacity: 0.75 }, cooldownRemaining > 0 && styles.emergencyBtnDisabled]}
          onPress={handleEmergencyUnlock}
        >
          <Feather name="alert-triangle" size={14} color={cooldownRemaining > 0 ? colors.mutedForeground : colors.warning} />
          <Text style={[styles.emergencyText, cooldownRemaining > 0 && { color: colors.mutedForeground }]}>
            {cooldownRemaining > 0
              ? `Emergency Unlock (cooldown: ${Math.ceil(cooldownRemaining / 60000)}m)`
              : "Emergency Unlock (30-min cooldown)"}
          </Text>
        </Pressable>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["apps", "whitelist", "rules", "schedule"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(t); }}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}>
        {/* APPS TAB */}
        {activeTab === "apps" && (
          <View style={styles.tabContent}>
            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
              <Pressable
                style={[styles.catChip, filterCat === "all" && styles.catChipActive]}
                onPress={() => setFilterCat("all")}
              >
                <Text style={[styles.catChipText, filterCat === "all" && { color: colors.primary }]}>All</Text>
              </Pressable>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.key}
                  style={[styles.catChip, filterCat === cat.key && { borderColor: cat.color, backgroundColor: cat.color + "18" }]}
                  onPress={() => setFilterCat(cat.key)}
                >
                  <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                  <Text style={[styles.catChipText, filterCat === cat.key && { color: cat.color }]}>{cat.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Add app */}
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add app name..."
                placeholderTextColor={colors.mutedForeground}
                value={addInput}
                onChangeText={setAddInput}
                onSubmitEditing={handleAddApp}
                returnKeyType="done"
              />
              <Pressable style={styles.addBtn} onPress={handleAddApp}>
                <Feather name="plus" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>

            {filteredApps.map((app) => (
              <AppRow
                key={app.name}
                app={app}
                onToggle={() => { Haptics.selectionAsync(); toggleAppBlocked(app.name); }}
                onRemove={() => removeApp(app.name)}
                categoryColor={CATEGORIES.find((c) => c.key === app.category)?.color ?? "#666"}
                styles={styles}
                colors={colors}
              />
            ))}
          </View>
        )}

        {/* WHITELIST TAB */}
        {activeTab === "whitelist" && (
          <View style={styles.tabContent}>
            <View style={styles.infoBox}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={styles.infoBoxText}>
                Whitelist apps remain accessible even in Strict Mode. Add only essential apps (Phone, Notes, etc.)
              </Text>
            </View>
            <Text style={styles.subsectionTitle}>Quick Add</Text>
            <View style={styles.presetGrid}>
              {WHITELIST_PRESETS.map((p) => (
                <Pressable
                  key={p.name}
                  style={({ pressed }) => [
                    styles.presetCard,
                    whitelistApps.includes(p.name) && styles.presetCardActive,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => toggleWhitelist(p.name)}
                >
                  <Feather name={p.icon as any} size={20} color={whitelistApps.includes(p.name) ? colors.success : colors.mutedForeground} />
                  <Text style={[styles.presetCardText, whitelistApps.includes(p.name) && { color: colors.success }]}>
                    {p.name}
                  </Text>
                  {whitelistApps.includes(p.name) && (
                    <View style={styles.presetCheck}>
                      <Feather name="check" size={10} color={colors.success} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
            <Text style={styles.subsectionTitle}>Whitelisted ({whitelistApps.length})</Text>
            {whitelistApps.map((name) => (
              <View key={name} style={styles.whitelistRow}>
                <View style={styles.whitelistIcon}>
                  <Feather name="check" size={14} color={colors.success} />
                </View>
                <Text style={styles.whitelistName}>{name}</Text>
                <Pressable hitSlop={12} onPress={() => toggleWhitelist(name)}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* RULES TAB */}
        {activeTab === "rules" && (
          <View style={styles.tabContent}>
            <View style={styles.infoBox}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={styles.infoBoxText}>Block by app name, website URL, or keyword. Rules apply globally during any active session.</Text>
            </View>

            {/* Rule type selector */}
            <View style={styles.ruleTypeRow}>
              {RULE_TYPES.map((rt) => (
                <Pressable
                  key={rt.key}
                  style={[styles.ruleTypeBtn, ruleType === rt.key && styles.ruleTypeBtnActive]}
                  onPress={() => setRuleType(rt.key)}
                >
                  <Feather name={rt.icon as any} size={13} color={ruleType === rt.key ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.ruleTypeBtnText, ruleType === rt.key && { color: colors.primary }]}>{rt.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={RULE_TYPES.find((r) => r.key === ruleType)?.placeholder ?? ""}
                placeholderTextColor={colors.mutedForeground}
                value={ruleInput}
                onChangeText={setRuleInput}
                onSubmitEditing={handleAddRule}
                returnKeyType="done"
                autoCapitalize="none"
              />
              <Pressable style={styles.addBtn} onPress={handleAddRule}>
                <Feather name="plus" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>

            {blockRules.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="slash" size={28} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No block rules</Text>
                <Text style={styles.emptySub}>Add apps, websites, or keywords to block them across all sessions</Text>
              </View>
            ) : (
              blockRules.map((rule) => (
                <View key={rule.id} style={styles.ruleRow}>
                  <View style={[styles.ruleTypeIcon, { backgroundColor: colors.primary + "18" }]}>
                    <Feather
                      name={RULE_TYPES.find((r) => r.key === rule.type)?.icon as any ?? "slash"}
                      size={14}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleValue}>{rule.value}</Text>
                    <Text style={styles.ruleTypeBadge}>{rule.type}</Text>
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
                    <Feather name="trash-2" size={15} color={colors.destructive} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === "schedule" && (
          <View style={styles.tabContent}>
            <View style={styles.infoBox}>
              <Feather name="clock" size={14} color={colors.warning} />
              <Text style={styles.infoBoxText}>
                Scheduled blocking auto-activates at set times. Perfect for bedtime, work hours, and study blocks.
              </Text>
            </View>
            {[
              { label: "Sleep Mode", icon: "moon", time: "11 PM – 7 AM", color: "#8b5cf6", days: "Every day" },
              { label: "Morning Focus", icon: "sunrise", time: "9 AM – 12 PM", color: "#f59e0b", days: "Mon – Fri" },
              { label: "Deep Work Block", icon: "anchor", time: "2 PM – 5 PM", color: "#6366f1", days: "Mon – Fri" },
              { label: "No Socials Evening", icon: "x-circle", time: "6 PM – 10 PM", color: "#ec4899", days: "Every day" },
            ].map((sched, i) => (
              <View key={i} style={styles.scheduleCard}>
                <View style={[styles.scheduleIcon, { backgroundColor: sched.color + "20" }]}>
                  <Feather name={sched.icon as any} size={18} color={sched.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleName}>{sched.label}</Text>
                  <Text style={styles.scheduleTime}>{sched.time} · {sched.days}</Text>
                </View>
                <Switch
                  value={i === 0}
                  trackColor={{ false: colors.border, true: sched.color }}
                  thumbColor={colors.foreground}
                  ios_backgroundColor={colors.border}
                />
              </View>
            ))}
            <Pressable style={styles.addScheduleBtn}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.addScheduleBtnText}>Add Schedule</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AppRow({
  app, onToggle, onRemove, categoryColor, styles, colors,
}: {
  app: AppEntry;
  onToggle: () => void;
  onRemove: () => void;
  categoryColor: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.appRow}>
      <View style={[styles.appCatBar, { backgroundColor: categoryColor }]} />
      <View style={[styles.appIcon, { backgroundColor: categoryColor + "20" }]}>
        <Feather name="smartphone" size={15} color={categoryColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.appName}>{app.name}</Text>
        <Text style={[styles.appCat, { color: categoryColor }]}>{app.category}</Text>
      </View>
      {app.dailyLimitMin && (
        <View style={styles.limitBadge}>
          <Text style={styles.limitText}>{app.dailyLimitMin}m limit</Text>
        </View>
      )}
      <Switch
        value={app.blocked}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.destructive }}
        thumbColor={colors.foreground}
        ios_backgroundColor={colors.border}
        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
      />
      <Pressable hitSlop={10} onPress={onRemove}>
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: c.foreground, letterSpacing: -0.6 },
    headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, marginTop: 2 },
    lockToggle: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.card, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: c.border },
    strictBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 20, marginBottom: 8, backgroundColor: c.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border },
    strictBannerActive: { borderColor: c.destructive + "66", backgroundColor: c.destructive + "10" },
    strictBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    strictBannerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground },
    strictBannerSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 1 },
    emergencyBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginBottom: 8, backgroundColor: c.warning + "18", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.warning + "44" },
    emergencyBtnDisabled: { backgroundColor: c.card, borderColor: c.border },
    emergencyText: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.warning },
    tabs: { flexDirection: "row", marginHorizontal: 20, marginBottom: 8, backgroundColor: c.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: c.border },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
    tabActive: { backgroundColor: c.primary },
    tabText: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
    tabTextActive: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
    tabContent: { paddingHorizontal: 20, gap: 10 },
    catChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    catChipActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    catChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
    catDot: { width: 7, height: 7, borderRadius: 3.5 },
    addRow: { flexDirection: "row", gap: 10 },
    input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontFamily: "Inter_400Regular", fontSize: 14, color: c.foreground },
    addBtn: { backgroundColor: c.primary, borderRadius: 12, width: 46, alignItems: "center", justifyContent: "center" },
    appRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: c.border, paddingRight: 12 },
    appCatBar: { width: 3, alignSelf: "stretch" },
    appIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", margin: 10 },
    appName: { fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    appCat: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
    limitBadge: { backgroundColor: c.warning + "22", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
    limitText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: c.warning },
    infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
    infoBoxText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, lineHeight: 18 },
    subsectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
    presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    presetCard: { width: "22%", aspectRatio: 1, backgroundColor: c.card, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, gap: 4, position: "relative" },
    presetCardActive: { borderColor: c.success, backgroundColor: c.success + "14" },
    presetCardText: { fontFamily: "Inter_400Regular", fontSize: 10, color: c.mutedForeground, textAlign: "center" },
    presetCheck: { position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: c.success + "22", alignItems: "center", justifyContent: "center" },
    whitelistRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.success + "44" },
    whitelistIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.success + "22", alignItems: "center", justifyContent: "center" },
    whitelistName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    ruleTypeRow: { flexDirection: "row", gap: 8 },
    ruleTypeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    ruleTypeBtnActive: { borderColor: c.primary, backgroundColor: c.primary + "18" },
    ruleTypeBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
    ruleRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
    ruleTypeIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    ruleValue: { fontFamily: "Inter_500Medium", fontSize: 14, color: c.foreground },
    ruleTypeBadge: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, textTransform: "capitalize" },
    empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
    emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: c.foreground },
    emptySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: c.mutedForeground, textAlign: "center", maxWidth: 260, lineHeight: 20 },
    scheduleCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border },
    scheduleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    scheduleName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground },
    scheduleTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 2 },
    addScheduleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.primary + "44", borderStyle: "dashed" },
    addScheduleBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.primary },
  });
}
