import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, TextInput } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage, tzParam } from "@/services/api";
import { useAuth } from "@/store/auth.store";
import { Card } from "@/components/Card";
import { Sol } from "@/components/Sol";
import { Button } from "@/components/Button";
import { MoodPicker, MoodKey, moodLabel } from "@/components/MoodPicker";
import { colors, radius, spacing, typography } from "@/theme";

/** What to offer right after a check-in, based on the mood picked. */
const FOLLOW_UP: Record<MoodKey, { text: string; cta: string; route: string }> = {
  very_happy: { text: "Lovely. Want to save what made today good?", cta: "Three good things", route: "/(tabs)/discover" },
  happy: { text: "Glad to hear it. A kind word to carry with you?", cta: "Today's affirmation", route: "/affirmations" },
  neutral: { text: "Okay days count too. A short reset might feel nice.", cta: "2-minute breathing", route: "/breathe" },
  sad: { text: "I'm sorry it feels heavy. I'm here if you want to talk.", cta: "Talk to Sol", route: "/(tabs)/chat" },
  anxious: { text: "Let's slow things down together for a moment.", cta: "Calming breath", route: "/breathe" },
  stressed: { text: "That sounds like a lot. One slow minute can help.", cta: "Box breathing", route: "/breathe" },
  tired: { text: "Rest is allowed. Maybe a gentle body scan?", cta: "See calm activities", route: "/(tabs)/discover" },
};

const INTENSITY = ["A little", "Some", "Moderate", "Strong", "Very strong"];

export default function Home() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [mood, setMood] = useState<MoodKey | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<MoodKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const affirmationQ = useQuery({
    queryKey: ["daily-affirmation"],
    queryFn: async () => (await api.get("/api/wellness/affirmations/daily")).data.affirmation,
  });
  const progressQ = useQuery({
    queryKey: ["progress"],
    queryFn: async () => (await api.get("/api/wellness/progress/overview", { params: tzParam() })).data,
  });
  const convQ = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await api.get("/api/conversations")).data.conversations,
  });
  const suggestionQ = useQuery({
    queryKey: ["suggestion"],
    queryFn: async () => (await api.get("/api/wellness/suggestion")).data,
    staleTime: 10 * 60_000,
  });

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }, [qc])
  );

  const refreshAll = () => {
    progressQ.refetch();
    convQ.refetch();
    affirmationQ.refetch();
    suggestionQ.refetch();
  };

  const submitMood = async () => {
    if (!mood || saving) return;
    setErr(null);
    setSaving(true);
    try {
      await api.post("/api/moods", { mood, intensity, note: note.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(mood);
      setMood(null);
      setNote("");
      setIntensity(3);
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ["mood-summary"] });
      qc.invalidateQueries({ queryKey: ["suggestion"] });
    } catch (e) {
      setErr(errorMessage(e, "Couldn't save your check-in."));
    } finally {
      setSaving(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const lastMood: MoodKey | undefined = progressQ.data?.moods?.[0]?.mood;
  const lastConv = convQ.data?.find((c: any) => c._count?.messages > 0);
  const streak: number = progressQ.data?.streak ?? 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={colors.sage} />}
    >
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={typography.h1}>
          {greeting}, {user?.displayName?.split(" ")[0] ?? "friend"}.
        </Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </Text>
      </Animated.View>

      {/* Daily check-in: the main action of the day */}
      <Animated.View entering={FadeInDown.delay(80).duration(500)}>
        <Card>
          <View style={styles.row}>
            <Sol size={56} />
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>
                {progressQ.data?.checkedInToday ? "Check in again?" : "How are you feeling?"}
              </Text>
              <Text style={typography.small}>A gentle check-in takes ten seconds.</Text>
            </View>
          </View>

          {saved ? (
            <Animated.View entering={FadeIn} style={{ marginTop: 14, gap: 10 }}>
              <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}>{FOLLOW_UP[saved].text}</Text>
              <View style={styles.row}>
                <Button label={FOLLOW_UP[saved].cta} variant="secondary" onPress={() => router.push(FOLLOW_UP[saved].route as any)} style={{ flex: 1 }} />
              </View>
              <Pressable onPress={() => setSaved(null)} hitSlop={8}>
                <Text style={styles.link}>Log another feeling</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              <View style={{ marginTop: 14 }}>
                <MoodPicker selected={mood} onSelect={(m) => setMood(m)} />
              </View>
              {mood && (
                <Animated.View entering={FadeIn} style={{ marginTop: 14, gap: 10 }}>
                  <Text style={typography.small}>How strong is it? · {INTENSITY[intensity - 1]}</Text>
                  <View style={styles.row}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        key={n}
                        accessibilityLabel={`Intensity ${n}`}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setIntensity(n);
                        }}
                        style={[styles.dot, n <= intensity && { backgroundColor: colors.sage, borderColor: colors.sage }]}
                      />
                    ))}
                  </View>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Anything on your mind? (optional)"
                    placeholderTextColor={colors.muted}
                    style={styles.note}
                    maxLength={500}
                    multiline
                  />
                </Animated.View>
              )}
              {err && <Text style={{ color: colors.danger, marginTop: 10 }}>{err}</Text>}
              <Button label="Save check-in" onPress={submitMood} disabled={!mood} loading={saving} style={{ marginTop: 14 }} />
            </>
          )}
        </Card>
      </Animated.View>

      {/* AI suggestion for today */}
      {suggestionQ.data?.suggestion ? (
        <Animated.View entering={FadeInDown.delay(140).duration(500)}>
          <Card style={{ backgroundColor: colors.sageSoft, borderColor: colors.sage }}>
            <Text style={typography.small}>SOL'S SUGGESTION FOR TODAY</Text>
            <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 22, marginTop: 6 }}>{suggestionQ.data.suggestion}</Text>
          </Card>
        </Animated.View>
      ) : null}

      {/* Talk to Sol */}
      <Animated.View entering={FadeInDown.delay(180).duration(500)}>
        <Pressable onPress={() => (lastConv ? router.push(`/chat/${lastConv.id}`) : router.push("/(tabs)/chat"))}>
          <Card style={{ backgroundColor: colors.lavenderSoft, borderColor: colors.lavender }}>
            <Text style={typography.h3}>{lastConv ? "Continue with Sol" : "Talk to Sol"}</Text>
            <Text style={{ color: colors.inkSoft, marginTop: 6, lineHeight: 21 }}>
              {lastConv
                ? `Pick up where you left off: "${lastConv.title}"`
                : lastMood
                ? `Last time you felt ${moodLabel(lastMood).toLowerCase()}. Want to talk about it?`
                : "I'm here whenever you'd like to share what's on your mind."}
            </Text>
            <Text style={{ color: colors.lavender, fontWeight: "700", marginTop: 12 }}>Open chat →</Text>
          </Card>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(500)}>
        <Pressable onPress={() => router.push("/affirmations")}>
          <Card>
            <Text style={typography.small}>TODAY'S AFFIRMATION</Text>
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.ink, marginTop: 6, lineHeight: 26 }}>
              {affirmationQ.data?.text ?? "…"}
            </Text>
          </Card>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(260).duration(500)}>
        <Text style={typography.h3}>Quick calm</Text>
        <View style={[styles.row, { marginTop: 10 }]}>
          <Tile emoji="🌬️" label="Breathe" sub="2–5 min" bg={colors.blueSoft} onPress={() => router.push("/breathe")} />
          <Tile emoji="🌿" label="Activities" sub="Small steps" bg={colors.peachSoft} onPress={() => router.push("/(tabs)/discover")} />
          <Tile emoji="🪞" label="Reflect" sub="2 min check" bg={colors.lavenderSoft} onPress={() => router.push("/assessment")} />
        </View>
      </Animated.View>

      <Pressable onPress={() => router.push("/(tabs)/insights")}>
        <Card>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <View>
              <Text style={typography.small}>CURRENT STREAK</Text>
              <Text style={{ fontSize: 28, fontWeight: "700", color: colors.ink }}>
                {streak} day{streak === 1 ? "" : "s"}
              </Text>
              <Text style={typography.small}>
                {streak === 0 ? "Check in today to start one." : progressQ.data?.checkedInToday ? "You've checked in today." : "Check in today to keep it going."}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={typography.small}>Check-ins</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.sage }}>{progressQ.data?.checkIns ?? 0}</Text>
            </View>
          </View>
        </Card>
      </Pressable>
    </ScrollView>
  );
}

function Tile({ emoji, label, sub, bg, onPress }: { emoji: string; label: string; sub: string; bg: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <View>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={styles.tileSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5), paddingTop: 64, gap: 16, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  tile: { flex: 1, borderRadius: radius.lg, padding: 14, height: 110, justifyContent: "space-between" },
  tileLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  tileSub: { fontSize: 12, color: colors.inkSoft },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  note: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 48,
    color: colors.ink,
    fontSize: 15,
  },
  link: { color: colors.sage, fontWeight: "600", textAlign: "center" },
});
