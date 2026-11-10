import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { BreathingCircle, BreathPhase } from "@/components/BreathingCircle";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { api } from "@/services/api";
import { colors, radius, spacing, typography } from "@/theme";

type Pattern = { key: string; name: string; desc: string; steps: [BreathPhase, number][] };

const PATTERNS: Pattern[] = [
  { key: "gentle", name: "Gentle", desc: "In 4 · out 6. Easy for beginners.", steps: [["inhale", 4], ["exhale", 6]] },
  { key: "box", name: "Box", desc: "In 4 · hold 4 · out 4 · hold 4.", steps: [["inhale", 4], ["hold", 4], ["exhale", 4], ["holdOut", 4]] },
  { key: "478", name: "4-7-8", desc: "In 4 · hold 7 · out 8. Slow and settling.", steps: [["inhale", 4], ["hold", 7], ["exhale", 8]] },
];
const LENGTHS = [1, 2, 3, 5]; // minutes

type Stage = "setup" | "running" | "done";

export default function Breathe() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [pattern, setPattern] = useState(PATTERNS[0]);
  const [minutes, setMinutes] = useState(2);
  const [stage, setStage] = useState<Stage>("setup");
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState({ step: 0, left: 0 }); // current step + seconds left in it
  const [elapsed, setElapsed] = useState(0);
  const logged = useRef(false);

  const total = minutes * 60;

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logged.current = false;
    setClock({ step: 0, left: pattern.steps[0][1] });
    setElapsed(0);
    setPaused(false);
    setStage("running");
  };

  const finish = (completedSeconds: number) => {
    setStage("done");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!logged.current && completedSeconds >= 30) {
      logged.current = true;
      api
        .post("/api/wellness/activities/log", { type: "breathing", duration: Math.max(1, Math.round(completedSeconds / 60)) })
        .then(() => qc.invalidateQueries({ queryKey: ["progress"] }))
        .catch(() => {});
    }
  };

  // One-second clock drives both the phase and the session length.
  useEffect(() => {
    if (stage !== "running" || paused) return;
    const t = setInterval(() => {
      setElapsed((e) => e + 1);
      setClock((c) => {
        if (c.left > 1) return { ...c, left: c.left - 1 };
        const next = (c.step + 1) % pattern.steps.length;
        return { step: next, left: pattern.steps[next][1] };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage, paused, pattern]);

  useEffect(() => {
    if (stage === "running" && elapsed >= total) finish(elapsed);
  }, [elapsed, stage, total]);

  // Soft tap at every phase change.
  useEffect(() => {
    if (stage === "running" && elapsed > 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clock.step]);

  const { step, left } = clock;

  const [phase, phaseSecs] = pattern.steps[step];
  const progress = Math.min(elapsed / total, 1);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.muted, fontSize: 15 }}>Close</Text>
        </Pressable>
        {stage === "running" && (
          <Text style={{ color: colors.muted }}>
            {Math.floor((total - elapsed) / 60)}:{String((total - elapsed) % 60).padStart(2, "0")} left
          </Text>
        )}
      </View>
      {stage === "running" && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {stage === "setup" && (
        <View style={styles.center}>
          <Text style={[typography.h1, { textAlign: "center" }]}>Breathe with Sol</Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 6, marginBottom: 20 }}>Pick a rhythm and follow the circle.</Text>
          <View style={{ gap: 10, width: "100%" }}>
            {PATTERNS.map((p) => (
              <Pressable key={p.key} onPress={() => { Haptics.selectionAsync(); setPattern(p); }}>
                <Card style={[styles.option, pattern.key === p.key && { borderColor: colors.sage, borderWidth: 2 }]}>
                  <Text style={typography.h3}>{p.name}</Text>
                  <Text style={typography.small}>{p.desc}</Text>
                </Card>
              </Pressable>
            ))}
          </View>
          <Text style={[typography.small, { marginTop: 18 }]}>LENGTH</Text>
          <View style={styles.lengths}>
            {LENGTHS.map((m) => (
              <Pressable key={m} onPress={() => { Haptics.selectionAsync(); setMinutes(m); }} style={[styles.len, minutes === m && styles.lenOn]}>
                <Text style={{ color: minutes === m ? colors.white : colors.ink, fontWeight: "600" }}>{m} min</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Begin" onPress={start} style={{ marginTop: 24, alignSelf: "stretch" }} />
        </View>
      )}

      {stage === "running" && (
        <View style={styles.center}>
          <BreathingCircle phase={phase} phaseMs={phaseSecs * 1000} secondsLeft={left} paused={paused} />
          <Text style={{ color: colors.muted, marginTop: 8 }}>{pattern.name} breathing</Text>
          <View style={styles.controls}>
            <Button label="Stop" variant="ghost" onPress={() => finish(elapsed)} style={{ flex: 1 }} />
            <Button label={paused ? "Resume" : "Pause"} onPress={() => setPaused((p) => !p)} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {stage === "done" && (
        <View style={styles.center}>
          <Text style={{ fontSize: 64 }}>🌿</Text>
          <Text style={typography.h1}>Well done</Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 6, lineHeight: 22 }}>
            You gave yourself {Math.max(1, Math.round(elapsed / 60))} minute{Math.round(elapsed / 60) > 1 ? "s" : ""} of calm.
            {"\n"}Notice how your body feels now.
          </Text>
          <View style={{ marginTop: 30, alignSelf: "stretch", gap: 10 }}>
            <Button label="Breathe again" variant="secondary" onPress={() => setStage("setup")} />
            <Button label="Back home" onPress={() => router.replace("/(tabs)/home")} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing(6) },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  track: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 12, overflow: "hidden" },
  fill: { height: 4, backgroundColor: colors.sage },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  option: { gap: 4 },
  lengths: { flexDirection: "row", gap: 8, marginTop: 8 },
  len: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  lenOn: { backgroundColor: colors.sage, borderColor: colors.sage },
  controls: { flexDirection: "row", gap: 12, alignSelf: "stretch", marginTop: 30 },
});
