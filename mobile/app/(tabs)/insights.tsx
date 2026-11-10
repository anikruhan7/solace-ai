import { useCallback } from "react";
import { ScrollView, Text, View, StyleSheet, RefreshControl, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tzParam } from "@/services/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { moodEmoji, moodLabel } from "@/components/MoodPicker";
import { colors, spacing, typography } from "@/theme";

const MILESTONES = [1, 3, 7, 14, 30];

function colorFor(mood: string) {
  switch (mood) {
    case "very_happy":
    case "happy":
      return colors.sage;
    case "neutral":
      return colors.blue;
    case "sad":
    case "tired":
      return colors.lavender;
    case "anxious":
    case "stressed":
      return colors.peach;
    default:
      return colors.border;
  }
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function Insights() {
  const qc = useQueryClient();
  const summaryQ = useQuery({ queryKey: ["mood-summary"], queryFn: async () => (await api.get("/api/moods/summary")).data });
  const progressQ = useQuery({
    queryKey: ["progress"],
    queryFn: async () => (await api.get("/api/wellness/progress/overview", { params: tzParam() })).data,
  });
  const assessQ = useQuery({ queryKey: ["assessment-latest"], queryFn: async () => (await api.get("/api/wellness/assessments/latest")).data.assessment });

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["mood-summary"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    }, [qc])
  );

  const entries: any[] = summaryQ.data?.entries ?? [];
  const counts: Record<string, number> = summaryQ.data?.counts ?? {};
  const total = summaryQ.data?.total ?? 0;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const streak: number = progressQ.data?.streak ?? 0;

  // Last 7 days: the latest mood logged each day.
  const week = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - k));
    const latest = [...entries].reverse().find((e) => dayKey(new Date(e.createdAt)) === dayKey(d));
    return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), mood: latest?.mood as string | undefined };
  });

  const nextMilestone = MILESTONES.find((m) => m > streak);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => { summaryQ.refetch(); progressQ.refetch(); assessQ.refetch(); }} tintColor={colors.sage} />}
    >
      <Text style={typography.h1}>Insights</Text>
      <Text style={{ color: colors.muted, marginBottom: 8 }}>A gentle look at your patterns.</Text>

      {summaryQ.isSuccess && total === 0 ? (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 28 }}>
          <Text style={{ fontSize: 40 }}>🌱</Text>
          <Text style={[typography.h3, { textAlign: "center" }]}>Your insights will grow here</Text>
          <Text style={{ color: colors.inkSoft, textAlign: "center", lineHeight: 21 }}>
            Check in with your mood for a few days and you'll start to see patterns.
          </Text>
          <Button label="Do my first check-in" onPress={() => router.push("/(tabs)/home")} style={{ alignSelf: "stretch", marginTop: 6 }} />
        </Card>
      ) : (
        <>
          <Card>
            <Text style={typography.small}>CURRENT STREAK</Text>
            <Text style={{ fontSize: 36, fontWeight: "700", color: colors.sage }}>
              {streak} day{streak === 1 ? "" : "s"}
            </Text>
            <Text style={typography.small}>
              {nextMilestone ? `${nextMilestone - streak} more day${nextMilestone - streak === 1 ? "" : "s"} to your ${nextMilestone}-day milestone` : "You've passed every milestone. Lovely."}
            </Text>
            <View style={styles.badges}>
              {MILESTONES.map((m) => (
                <View key={m} style={[styles.badge, streak >= m && { backgroundColor: colors.sage }]}>
                  <Text style={{ color: streak >= m ? colors.white : colors.muted, fontWeight: "700", fontSize: 12 }}>{m}d</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={typography.small}>THIS WEEK</Text>
            <View style={styles.week}>
              {week.map((d, k) => (
                <View key={k} style={{ alignItems: "center", gap: 6 }}>
                  <View style={[styles.weekDot, { backgroundColor: d.mood ? colorFor(d.mood) : colors.bgAlt }]}>
                    <Text style={{ fontSize: 16 }}>{d.mood ? moodEmoji(d.mood) : ""}</Text>
                  </View>
                  <Text style={typography.small}>{d.label}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={typography.small}>LAST 30 DAYS</Text>
            <View style={styles.stats}>
              <Stat label="Check-ins" value={total} />
              <Stat label="Activities" value={progressQ.data?.completions30d ?? 0} />
              <Stat label="Avg intensity" value={(summaryQ.data?.avgIntensity ?? 0).toFixed(1)} />
            </View>
          </Card>

          {sorted.length > 0 && (
            <Card>
              <Text style={typography.small}>HOW YOU'VE FELT</Text>
              <View style={{ gap: 10, marginTop: 12 }}>
                {sorted.map(([mood, n]) => (
                  <View key={mood} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.ink }}>
                        {moodEmoji(mood)} {moodLabel(mood)}
                      </Text>
                      <Text style={typography.small}>{n}</Text>
                    </View>
                    <View style={styles.bar}>
                      <View style={{ width: `${(n / total) * 100}%`, height: 8, borderRadius: 4, backgroundColor: colorFor(mood) }} />
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      )}

      <Pressable onPress={() => router.push("/assessment")}>
        <Card style={{ backgroundColor: colors.peachSoft, borderColor: colors.peach }}>
          <Text style={typography.small}>REFLECTION CHECK</Text>
          <Text style={[typography.h3, { marginTop: 4 }]}>
            {assessQ.data ? `Last score: ${assessQ.data.score}/100` : "Take a 2-minute reflection"}
          </Text>
          <Text style={{ color: colors.inkSoft, marginTop: 4 }}>
            {assessQ.data ? `On ${new Date(assessQ.data.createdAt).toLocaleDateString()}. Tap to retake.` : "Six gentle questions about your week."}
          </Text>
        </Card>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View>
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5), paddingTop: 64, paddingBottom: 40, gap: 12 },
  badges: { flexDirection: "row", gap: 8, marginTop: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.bgAlt },
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  weekDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.bgAlt, overflow: "hidden" },
});
