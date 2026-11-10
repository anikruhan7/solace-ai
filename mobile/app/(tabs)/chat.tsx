import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { Button } from "@/components/Button";
import { Sol } from "@/components/Sol";
import { Card } from "@/components/Card";
import { colors, spacing, typography } from "@/theme";

function when(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString();
}

export default function ChatList() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const conversationsQ = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await api.get("/api/conversations")).data.conversations,
  });

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }, [qc])
  );

  const startNew = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/api/conversations", {});
      router.push(`/chat/${data.conversation.id}`);
    } catch (e) {
      Alert.alert("Couldn't start a chat", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (c: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete conversation?", `"${c.title}" will be removed for good.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/conversations/${c.id}`);
            qc.invalidateQueries({ queryKey: ["conversations"] });
          } catch (e) {
            Alert.alert("Couldn't delete", errorMessage(e));
          }
        },
      },
    ]);
  };

  const list = (conversationsQ.data ?? []).filter((c: any) => c._count.messages > 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Sol size={64} />
        <View style={{ flex: 1 }}>
          <Text style={typography.h1}>Sol</Text>
          <Text style={{ color: colors.muted }}>Here to listen, any time.</Text>
        </View>
      </View>

      <Button label="Start a new conversation" onPress={startNew} loading={busy} />

      <ScrollView style={{ marginTop: 20 }} contentContainerStyle={{ gap: 10, paddingBottom: 40 }}>
        {conversationsQ.isLoading && <ActivityIndicator color={colors.sage} style={{ marginTop: 30 }} />}
        {conversationsQ.isError && (
          <Pressable onPress={() => conversationsQ.refetch()}>
            <Text style={styles.empty}>Couldn't load your chats. Tap to retry.</Text>
          </Pressable>
        )}
        {conversationsQ.isSuccess && list.length === 0 && (
          <Text style={styles.empty}>No conversations yet. Say hi to Sol whenever you're ready.</Text>
        )}
        {list.map((c: any) => (
          <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}`)} onLongPress={() => remove(c)}>
            <Card style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3} numberOfLines={1}>
                  {c.title}
                </Text>
                <Text style={typography.small}>
                  {c._count.messages} messages · {when(c.updatedAt)}
                </Text>
              </View>
              <Pressable onPress={() => remove(c)} hitSlop={12} accessibilityLabel="Delete conversation">
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing(5), paddingTop: 64 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  item: { flexDirection: "row", alignItems: "center", gap: 12 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40, lineHeight: 22 },
});
