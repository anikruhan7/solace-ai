import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, radius, spacing, typography } from "@/theme";

// Answers score 0 (not at all) .. 4 (nearly always). "reverse" items are worded negatively.
const QUESTIONS = [
  { id: "rested", text: "Over the past week, I've felt rested.", reverse: false },
  { id: "overwhelmed", text: "I've felt overwhelmed by what's on my plate.", reverse: true },
  { id: "connected", text: "I've felt connected to people I care about.", reverse: false },
  { id: "worry", text: "Worries have been hard to switch off.", reverse: true },
  { id: "enjoy", text: "I've been able to enjoy small things.", reverse: false },
  { id: "kind", text: "I've been kind to myself.", reverse: false },
];
const OPTIONS = ["Not at all", "Rarely", "Sometimes", "Often", "Nearly always"];

function result(score: number) {
  if (score >= 70) return { title: "You seem to be in a steady place", body: "Keep the small habits that are working. A gratitude moment can help you notice them.", cta: "Three good things", route: "/(tabs)/discover" };
  if (score >= 45) return { title: "Some things feel heavy right now", body: "That's very human. A few slow breaths or a chat with Sol might help you sort through it.", cta: "Breathe for 2 minutes", route: "/breathe" };
  return { title: "It sounds like a hard stretch", body: "Please be gentle with yourself. Talking to someone you trust can really help, and Sol is here to listen too.", cta: "Talk to Sol", route: "/(tabs)/chat" };
}

export default function Assessment() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = async (value: number) => {
    Haptics.selectionAsync();
    const next = { ...answers, [QUESTIONS[i].id]: value };
    setAnswers(next);
    if (i < QUESTIONS.length - 1) return setI(i + 1);

    const points = QUESTIONS.reduce((sum, q) => sum + (q.reverse ? 4 - next[q.id] : next[q.id]), 0);
    const s = Math.round((points / (QUESTIONS.length * 4)) * 100);
    setSaving(true);
    setErr(null);
    try {
      await api.post("/api/wellness/assessments", { answers: next, score: s });
      qc.invalidateQueries({ queryKey: ["assessment-latest"] });
      setScore(s);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setErr(errorMessage(e, "Couldn't save your answers."));
    } finally {
      setSaving(false);
    }
  };

  const r = score !== null ? result(score) : null;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing(6), paddingTop: insets.top + 16, paddingBottom: 40, flexGrow: 1 }}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={{ color: colors.muted }}>Close</Text>
      </Pressable>

      {r ? (
        <View style={{ flex: 1, justifyContent: "center", gap: 16 }}>
          <Text style={typography.small}>YOUR REFLECTION</Text>
          <Text style={typography.h1}>{r.title}</Text>
          <Card>
            <Text style={{ fontSize: 40, fontWeight: "700", color: colors.sage }}>{score}/100</Text>
            <Text style={{ color: colors.inkSoft, marginTop: 8, lineHeight: 22 }}>{r.body}</Text>
          </Card>
          <Button label={r.cta} onPress={() => router.replace(r.route as any)} />
          <Text style={typography.small}>This is a self-reflection tool, not a clinical test or diagnosis. With your permission, Sol uses the score to tailor suggestions.</Text>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={typography.small}>
            QUESTION {i + 1} OF {QUESTIONS.length}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${((i + 1) / QUESTIONS.length) * 100}%` }]} />
          </View>
          <Animated.View key={i} entering={FadeInRight.duration(300)}>
            <Text style={[typography.h2, { marginTop: 24, marginBottom: 20, lineHeight: 30 }]}>{QUESTIONS[i].text}</Text>
            <View style={{ gap: 10 }}>
              {OPTIONS.map((o, v) => (
                <Pressable key={o} disabled={saving} onPress={() => pick(v)} style={({ pressed }) => [styles.opt, (pressed || answers[QUESTIONS[i].id] === v) && styles.optOn]}>
                  <Text style={{ color: colors.ink, fontSize: 16 }}>{o}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
          {err && <Text style={{ color: colors.danger, marginTop: 12 }}>{err}</Text>}
          {i > 0 && (
            <Pressable onPress={() => setI(i - 1)} style={{ marginTop: 20 }}>
              <Text style={{ color: colors.sage, fontWeight: "600" }}>← Previous question</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 8, overflow: "hidden" },
  fill: { height: 6, backgroundColor: colors.sage },
  opt: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, borderWidth: 1.5, borderColor: colors.border },
  optOn: { borderColor: colors.sage, backgroundColor: colors.sageSoft },
});
