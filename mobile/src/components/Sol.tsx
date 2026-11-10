import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withDelay,
} from "react-native-reanimated";
import { colors } from "@/theme";

export function Sol({ size = 120 }: { size?: number }) {
  const scale = useSharedValue(0.95);
  const glow = useSharedValue(0.4);
  const eye = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.05, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    glow.value = withRepeat(
      withTiming(0.7, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    eye.value = withDelay(
      1200,
      withRepeat(withTiming(0.2, { duration: 140 }), 6, true)
    );
  }, []);

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: eye.value }] }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          { position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: colors.sageSoft },
          glowStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: size,
            backgroundColor: colors.lavenderSoft,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: colors.lavender,
          },
          orbStyle,
        ]}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Animated.View style={[styles.eye, eyeStyle]} />
          <Animated.View style={[styles.eye, eyeStyle]} />
        </View>
        <View style={styles.smile} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  eye: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink,
  },
  smile: {
    marginTop: 8,
    width: 22,
    height: 11,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: colors.ink,
  },
});