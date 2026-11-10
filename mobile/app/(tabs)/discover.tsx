import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { Card } from "@/components/Card";
import { colors, spacing, typography } from "@/theme";

const HOW_TO: Record<string, string> = {
  "box-breathing": "Breathe in for 4, hold for 4, out for 4, hold for 4. Repeat four times.",
  "478-breathing": "Breathe in through your nose for 4, hold for 7, then breathe out slowly for 8.",
  "gratitude-3": "Think of three small good moments from today. Write each down in one line.",
  "body-scan": "Close your eyes. Move your attention from your head down to your toes, noticing without judging.",
  "self-kindness-note": "Write a short note to yourself the way you would to a friend who's having a hard day.",
};

export default function Discover() {
  const qc = useQueryClient();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const activitiesQ = useQuery({
    queryKey: ["activities"],
    queryFn: async () => (await api.get("/api/wellness/activities")).data.activities,
  });

  const open = (a: any) => {
    if (a.category === "breathing") return router.push("/breathe");
    Alert.alert(a.title, HOW_TO[a.slug] ?? a.description, [
      { text: "Later", style: "cancel" },
      {
        text: "I did it",
        onPress: async () => {
          try {
            await api.post(`/api/wellness/activities/${a.id}/complete`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setDone((d) => ({ ...d, [a.id]: true }));
            qc.invalidateQueries({ queryKey: ["progress"] });
          } catch (e) {
            Alert.alert("Couldn't save", errorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={typography.h1}>Discover</Text>
      <Text style={{ color: colors.muted, marginBottom: 8 }}>Small practices, gentle moments.</Text>

      <View style={styles.grid}>
        <Feature emoji="🌬️" title="Breathing" sub="Guided rhythms" bg={colors.blueSoft} onPress={() => router.push("/breathe")} />
        <Feature emoji="✨" title="Affirmations" sub="Kind words" bg={colors.lavenderSoft} onPress={() => router.push("/affirmations")} />
        <Feature emoji="🪞" title="Reflection" sub="2-minute check" bg={colors.peachSoft} onPress={() => router.push("/assessment")} />
        <Feature emoji="💬" title="Talk to Sol" sub="Any time" bg={colors.sageSoft} onPress={() => router.push("/(tabs)/chat")} />
      </View>

      <Text style={{ ...typography.h3, marginTop: 12 }}>Activities</Text>
      {activitiesQ.isError && (
        <Pressable onPress={() => activitiesQ.refetch()}>
          <Text style={{ color: colors.danger }}>Couldn't load activities. Tap to retry.</Text>
        </Pressable>
      )}
      {activitiesQ.data?.map((a: any) => (
        <Pressable key={a.id} onPress={() => open(a)}>
          <Card style={done[a.id] ? { borderColor: colors.sage } : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={typography.h3}>{a.title}</Text>
              {done[a.id] && <Text style={{ color: colors.sage, fontWeight: "700" }}>Done ✓</Text>}
            </View>
            <Text style={{ color: colors.inkSoft, marginTop: 4 }}>{a.description}</Text>
            <Text style={[typography.small, { marginTop: 6 }]}>
              {a.duration} min · {a.category}
            </Text>
          </Card>
        </Pressable>
      ))}

      <Card style={{ backgroundColor: colors.bgAlt, marginTop: 8 }}>
        <Text style={typography.h3}>Need more support?</Text>
        <Text style={{ color: colors.inkSoft, marginTop: 6, lineHeight: 21 }}>
          Solace is a self-care companion, not medical care. If you are in danger or thinking about hurting yourself, contact your local emergency
          number or someone you trust right now.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Feature({ emoji, title, sub, bg, onPress }: { emoji: string; title: string; sub: string; bg: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.feature, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }]}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <View>
        <Text style={typography.h3}>{title}</Text>
        <Text style={typography.small}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(5), paddingTop: 64, paddingBottom: 40, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  feature: { width: "47.5%", height: 120, borderRadius: 24, padding: 16, justifyContent: "space-between" },
});
