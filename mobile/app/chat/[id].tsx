import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api, errorMessage } from "@/services/api";
import { useAuth } from "@/store/auth.store";
import { Sol } from "@/components/Sol";
import { colors, radius, spacing, typography } from "@/theme";

type Msg = { id: string; role: "user" | "assistant"; content: string; failed?: boolean };

const STARTERS = ["I've had a rough day", "I feel anxious and can't settle", "Help me wind down for sleep", "Something good happened today"];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const name = useAuth((s) => s.user?.displayName?.split(" ")[0]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<{ content: string; error: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const convQ = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => (await api.get(`/api/conversations/${id}`)).data.conversation,
  });

  const messages: Msg[] = convQ.data?.messages ?? [];
  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  useEffect(() => {
    scrollToEnd();
  }, [messages.length, sending, failed]);

  const send = async (raw?: string) => {
    const content = (raw ?? text).trim();
    if (!content || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText("");
    setFailed(null);
    setSending(true);
    const tempId = "tmp-" + Date.now();
    qc.setQueryData(["conversation", id], (prev: any) => ({
      ...prev,
      messages: [...(prev?.messages ?? []), { id: tempId, role: "user", content }],
    }));
    try {
      const { data } = await api.post(`/api/conversations/${id}/messages`, { content });
      qc.setQueryData(["conversation", id], (prev: any) => ({
        ...prev,
        messages: [...(prev?.messages ?? []).filter((m: Msg) => m.id !== tempId), data.userMessage, data.message],
      }));
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      // Nothing was saved on the server; drop the bubble and offer a retry with the same text.
      qc.setQueryData(["conversation", id], (prev: any) => ({
        ...prev,
        messages: (prev?.messages ?? []).filter((m: Msg) => m.id !== tempId),
      }));
      setFailed({ content, error: errorMessage(e, "Sol couldn't reply just now.") });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setSending(false);
    }
  };

  const remove = () =>
    Alert.alert("Delete this conversation?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/conversations/${id}`);
            qc.invalidateQueries({ queryKey: ["conversations"] });
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete", errorMessage(e));
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
        <Sol size={34} />
        <Text style={{ ...typography.h3, flex: 1 }} numberOfLines={1}>
          {messages.length ? convQ.data?.title : "Sol"}
        </Text>
        {messages.length > 0 && (
          <Pressable onPress={remove} hitSlop={10} accessibilityLabel="Delete conversation">
            <Ionicons name="trash-outline" size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing(4), gap: 10, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        {convQ.isError && (
          <Pressable onPress={() => convQ.refetch()}>
            <Text style={{ color: colors.danger, textAlign: "center" }}>Couldn't load this chat. Tap to retry.</Text>
          </Pressable>
        )}

        {convQ.isSuccess && messages.length === 0 && !sending && (
          <Animated.View entering={FadeInUp.duration(500)} style={styles.welcome}>
            <Sol size={110} />
            <Text style={[typography.h2, { textAlign: "center" }]}>Hi{name ? ` ${name}` : ""}, I'm Sol.</Text>
            <Text style={{ color: colors.inkSoft, textAlign: "center", lineHeight: 22 }}>
              This is a calm space. Tell me what's on your mind, big or small. I listen first.
            </Text>
            <View style={styles.chips}>
              {STARTERS.map((s) => (
                <Pressable key={s} onPress={() => send(s)} style={styles.chip}>
                  <Text style={{ color: colors.ink }}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[typography.small, { textAlign: "center" }]}>Sol is an AI companion, not a therapist. In an emergency, contact local emergency services.</Text>
          </Animated.View>
        )}

        {messages.map((m) => (
          <Animated.View key={m.id} entering={FadeInUp.duration(250)} style={[styles.bubble, m.role === "user" ? styles.user : styles.assistant]}>
            <Text style={{ color: m.role === "user" ? colors.white : colors.ink, fontSize: 15, lineHeight: 22 }}>{m.content}</Text>
          </Animated.View>
        ))}

        {sending && (
          <View style={[styles.bubble, styles.assistant]}>
            <Text style={{ color: colors.muted }}>Sol is thinking…</Text>
          </View>
        )}

        {failed && (
          <View style={styles.failed}>
            <Text style={{ color: colors.ink }} numberOfLines={2}>
              "{failed.content}"
            </Text>
            <Text style={{ color: colors.danger, marginTop: 4 }}>{failed.error}</Text>
            <Pressable onPress={() => send(failed.content)} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.sage, fontWeight: "700" }}>Try again</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Say anything…"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={4000}
          style={styles.input}
        />
        <Pressable
          onPress={() => send()}
          style={[styles.sendBtn, (sending || !text.trim()) && { opacity: 0.5 }]}
          disabled={sending || !text.trim()}
          accessibilityLabel="Send"
        >
          <Ionicons name="arrow-up" size={22} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  welcome: { alignItems: "center", gap: 12, paddingTop: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginVertical: 6 },
  chip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 10 },
  bubble: { maxWidth: "82%", paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.lg },
  user: { alignSelf: "flex-end", backgroundColor: colors.sage, borderBottomRightRadius: 6 },
  assistant: { alignSelf: "flex-start", backgroundColor: colors.card, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border },
  failed: { alignSelf: "flex-end", maxWidth: "85%", backgroundColor: colors.peachSoft, borderRadius: radius.md, padding: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sage, alignItems: "center", justifyContent: "center" },
});
