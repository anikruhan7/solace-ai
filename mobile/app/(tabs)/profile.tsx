import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, StyleSheet, Alert, TextInput } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth, Preferences } from "@/store/auth.store";
import { api, errorMessage } from "@/services/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Sol } from "@/components/Sol";
import { colors, radius, spacing, typography } from "@/theme";
import { REMINDERS, syncReminders, cancelAllReminders, sendTestReminder } from "@/notifications/setup";

const TIMES = ["07:00", "08:00", "09:00", "12:00", "15:00", "18:00", "20:00", "21:00", "22:00"];

function pretty(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function Profile() {
  const { user, logout, setUser } = useAuth();
  const prefs = (user?.preferences ?? {}) as Partial<Preferences>;
  const [openTime, setOpenTime] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? "");

  /** Optimistic update; reminders are re-synced from the saved preferences so on/off and times always match the server. */
  const update = async (patch: Partial<Preferences>) => {
    if (!user) return;
    Haptics.selectionAsync();
    const prev = user;
    setUser({ ...user, preferences: { ...(prefs as Preferences), ...patch } });
    try {
      const { data } = await api.patch("/api/profile/preferences", patch);
      setUser({ ...useAuth.getState().user!, preferences: data.preferences });
      const touchesReminders = Object.keys(patch).some((k) => REMINDERS.some((r) => r.key === k || r.timeKey === k));
      if (touchesReminders) {
        const ok = await syncReminders(data.preferences);
        if (!ok) Alert.alert("Notifications are off", "Allow notifications for Solace in your phone settings to get reminders.");
      }
    } catch (e) {
      setUser(prev);
      Alert.alert("Couldn't save", errorMessage(e));
    }
  };

  const saveName = async () => {
    const displayName = name.trim();
    if (!displayName || !user) return setEditing(false);
    try {
      const { data } = await api.patch("/api/profile", { displayName });
      setUser({ ...user, displayName: data.user.displayName });
      setEditing(false);
    } catch (e) {
      Alert.alert("Couldn't save", errorMessage(e));
    }
  };

  const signOut = async () => {
    await cancelAllReminders();
    await logout();
    router.replace("/(auth)/login");
  };

  const deleteAccount = () =>
    Alert.alert("Delete your account?", "All your check-ins, conversations and settings will be permanently deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete("/api/profile/account");
            await signOut();
          } catch (e) {
            Alert.alert("Couldn't delete", errorMessage(e));
          }
        },
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={typography.h1}>Profile</Text>

      <Card style={styles.row}>
        <Sol size={56} />
        <View style={{ flex: 1 }}>
          {editing ? (
            <TextInput value={name} onChangeText={setName} autoFocus onSubmitEditing={saveName} onBlur={saveName} style={styles.nameInput} maxLength={60} />
          ) : (
            <Text style={typography.h3}>{user?.displayName}</Text>
          )}
          <Text style={typography.small}>{user?.email}</Text>
        </View>
        <Pressable onPress={() => (editing ? saveName() : setEditing(true))} hitSlop={10}>
          <Text style={{ color: colors.sage, fontWeight: "700" }}>{editing ? "Save" : "Edit"}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={typography.small}>GENTLE REMINDERS</Text>
        {REMINDERS.map((r) => {
          const on = !!prefs[r.key];
          const time = (prefs[r.timeKey] as string) ?? "09:00";
          return (
            <View key={r.key} style={styles.reminder}>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{r.label}</Text>
                  <Pressable disabled={!on} onPress={() => setOpenTime(openTime === r.key ? null : r.key)} hitSlop={6}>
                    <Text style={{ color: on ? colors.sage : colors.muted, fontWeight: "600", marginTop: 2 }}>
                      {pretty(time)} {on ? "· change" : ""}
                    </Text>
                  </Pressable>
                </View>
                <Switch value={on} onValueChange={(v) => update({ [r.key]: v })} trackColor={{ true: colors.sage, false: colors.border }} thumbColor={colors.white} />
              </View>
              {openTime === r.key && on && (
                <View style={styles.times}>
                  {TIMES.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => {
                        setOpenTime(null);
                        update({ [r.timeKey]: t });
                      }}
                      style={[styles.time, t === time && styles.timeOn]}
                    >
                      <Text style={{ color: t === time ? colors.white : colors.ink, fontSize: 13 }}>{pretty(t)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <Pressable
          onPress={async () => {
            const ok = await sendTestReminder();
            Alert.alert(ok ? "On its way" : "Notifications are off", ok ? "A test reminder will arrive in about 5 seconds." : "Allow notifications in your phone settings.");
          }}
          style={{ marginTop: 10 }}
        >
          <Text style={{ color: colors.sage, fontWeight: "700" }}>Send a test reminder</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={typography.small}>AI & PRIVACY</Text>
        <ToggleRow
          label="Personalized responses"
          hint="Sol can use your name, recent check-ins and past chat topics."
          value={prefs.aiPersonalization ?? true}
          onChange={(v) => update({ aiPersonalization: v })}
        />
        <ToggleRow
          label="Use my moods for context"
          hint="Let Sol see your last few mood check-ins."
          value={(prefs.aiPersonalization ?? true) && (prefs.aiUseMoodContext ?? true)}
          disabled={!(prefs.aiPersonalization ?? true)}
          onChange={(v) => update({ aiUseMoodContext: v })}
        />
      </Card>

      <Card>
        <Text style={typography.small}>ABOUT</Text>
        <Text style={{ color: colors.inkSoft, marginTop: 8, lineHeight: 21 }}>
          Solace is an AI wellness companion for everyday self-care. It isn't a medical service. If you're in crisis, contact local emergency
          services or someone you trust.
        </Text>
      </Card>

      <Button label="Sign out" variant="ghost" onPress={signOut} />
      <Pressable onPress={deleteAccount} style={{ alignSelf: "center", padding: 8 }}>
        <Text style={{ color: colors.danger, fontWeight: "600" }}>Delete account</Text>
      </Pressable>
    </ScrollView>
  );
}

function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={[styles.row, { justifyContent: "space-between", paddingVertical: 10, opacity: disabled ? 0.5 : 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint && <Text style={typography.small}>{hint}</Text>}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.sage, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5), paddingTop: 64, paddingBottom: 40, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { color: colors.ink, fontSize: 15, fontWeight: "500" },
  reminder: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  time: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  timeOn: { backgroundColor: colors.sage, borderColor: colors.sage },
  nameInput: { fontSize: 17, fontWeight: "600", color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.sage, paddingVertical: 2 },
});
