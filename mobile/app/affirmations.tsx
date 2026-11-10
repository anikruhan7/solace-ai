import { useState } from "react";
import { View, Text, ScrollView, Pressable, Share, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { Card } from "@/components/Card";
import { colors, radius, spacing, typography } from "@/theme";

type Affirmation = { id: string; text: string; category: string; favorited?: boolean };

export default function Affirmations() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const dailyQ = useQuery<Affirmation | null>({
    queryKey: ["daily-affirmation"],
    queryFn: async () => (await api.get("/api/wellness/affirmations/daily")).data.affirmation,
  });
  const favsQ = useQuery({
    queryKey: ["aff-favs"],
    queryFn: async () => (await api.get("/api/wellness/affirmations/favorites")).data.favorites,
  });
  const [current, setCurrent] = useState<Affirmation | null>(null);
  const [loadingNew, setLoadingNew] = useState(false);
  const shown = current ?? dailyQ.data ?? null;

  const toggleFav = async (a: Affirmation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { data } = await api.post(`/api/wellness/affirmations/${a.id}/favorite`);
      if (current?.id === a.id) setCurrent({ ...a, favorited: data.favorited });
      qc.setQueryData(["daily-affirmation"], (d: Affirmation | null) => (d?.id === a.id ? { ...d, favorited: data.favorited } : d));
      qc.invalidateQueries({ queryKey: ["aff-favs"] });
    } catch {}
  };

  const another = async () => {
    setLoadingNew(true);
    try {
      const { data } = await api.get("/api/wellness/affirmations/random", { params: { exclude: shown?.id } });
      if (data.affirmation) setCurrent(data.affirmation);
    } finally {
      setLoadingNew(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing(6), paddingTop: insets.top + 16, gap: 16, paddingBottom: 40 }}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ alignSelf: "flex-start" }}>
        <Ionicons name="chevron-back" size={26} color={colors.ink} />
      </Pressable>
      <Text style={typography.h1}>Affirmations</Text>

      {dailyQ.isLoading && <ActivityIndicator color={colors.lavender} />}
      {shown && (
        <Animated.View key={shown.id} entering={FadeIn.duration(400)}>
          <Card style={{ backgroundColor: colors.lavenderSoft, borderColor: colors.lavender, paddingVertical: 28 }}>
            <Text style={typography.small}>{current ? shown.category.toUpperCase() : "TODAY"}</Text>
            <Text style={styles.big}>{shown.text}</Text>
            <View style={styles.actions}>
              <Action icon={shown.favorited ? "heart" : "heart-outline"} label={shown.favorited ? "Saved" : "Save"} onPress={() => toggleFav(shown)} />
              <Action icon="share-outline" label="Share" onPress={() => Share.share({ message: `${shown.text}\n— via Solace` })} />
              <Action icon="refresh" label={loadingNew ? "…" : "Another"} onPress={another} />
            </View>
          </Card>
        </Animated.View>
      )}

      <Text style={{ ...typography.h3, marginTop: 12 }}>Your favorites</Text>
      {favsQ.data?.length === 0 && <Text style={{ color: colors.muted }}>Tap the heart on any affirmation to keep it here.</Text>}
      {favsQ.data?.map((f: any) => (
        <Card key={f.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 22, flex: 1 }}>{f.affirmation.text}</Text>
          <Pressable onPress={() => toggleFav({ ...f.affirmation, favorited: true })} hitSlop={10} accessibilityLabel="Remove from favorites">
            <Ionicons name="heart" size={20} color={colors.lavender} />
          </Pressable>
        </Card>
      ))}
    </ScrollView>
  );
}

function Action({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.action} hitSlop={6}>
      <Ionicons name={icon} size={18} color={colors.lavender} />
      <Text style={{ color: colors.lavender, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 22, fontWeight: "600", color: colors.ink, marginTop: 10, lineHeight: 32 },
  actions: { flexDirection: "row", gap: 10, marginTop: 20, flexWrap: "wrap" },
  action: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 8 },
});
