import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation } from "react-native-reanimated";
import { colors } from "@/theme";

export type BreathPhase = "inhale" | "hold" | "exhale" | "holdOut";

const LABEL: Record<BreathPhase, string> = { inhale: "Breathe in", hold: "Hold", exhale: "Breathe out", holdOut: "Hold" };

/** Pure visual: grows on inhale, shrinks on exhale, rests on holds. Timing is owned by the screen. */
export function BreathingCircle({
  phase,
  phaseMs,
  secondsLeft,
  paused,
}: {
  phase: BreathPhase;
  phaseMs: number;
  secondsLeft: number;
  paused: boolean;
}) {
  const scale = useSharedValue(0.7);

  useEffect(() => {
    if (paused) {
      cancelAnimation(scale);
      return;
    }
    const target = phase === "inhale" ? 1.15 : phase === "exhale" ? 0.7 : null;
    if (target !== null) {
      // Animate only the remaining part of the phase, so resume continues smoothly.
      scale.value = withTiming(target, { duration: Math.max(secondsLeft * 1000, 300), easing: Easing.inOut(Easing.ease) });
    }
  }, [phase, paused, phaseMs]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite" accessibilityLabel={`${LABEL[phase]}, ${secondsLeft} seconds`}>
      <Animated.View style={[styles.circleOuter, circleStyle]} />
      <Animated.View style={[styles.circleMid, circleStyle]} />
      <View style={styles.circleInner}>
        <Text style={styles.label}>{paused ? "Paused" : LABEL[phase]}</Text>
        <Text style={styles.count}>{secondsLeft}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", height: 320 },
  circleOuter: { position: "absolute", width: 270, height: 270, borderRadius: 135, backgroundColor: colors.sageSoft, opacity: 0.7 },
  circleMid: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: colors.lavenderSoft, opacity: 0.8 },
  circleInner: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.sage,
  },
  label: { fontSize: 20, fontWeight: "700", color: colors.ink },
  count: { fontSize: 28, fontWeight: "300", color: colors.inkSoft, marginTop: 4 },
});
