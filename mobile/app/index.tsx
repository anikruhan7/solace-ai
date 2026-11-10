import { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sol } from "@/components/Sol";
import { useAuth } from "@/store/auth.store";
import { colors } from "@/theme";

export default function Splash() {
  const { loading, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(async () => {
      const seen = await AsyncStorage.getItem("solace_onboarded");
      if (user) router.replace("/(tabs)/home");
      else if (seen) router.replace("/(auth)/login");
      else router.replace("/onboarding");
    }, 1100);
    return () => clearTimeout(t);
  }, [loading, user]);

  return (
    <LinearGradient colors={[colors.bg, colors.lavenderSoft]} style={styles.wrap}>
      <Animated.View entering={FadeInDown.duration(700)}>
        <Sol size={140} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(250).duration(700)} style={styles.brand}>
        Solace
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(500).duration(700)}>
        <Text style={styles.tag}>A calm space to understand how you feel.</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  brand: { marginTop: 20, fontSize: 36, fontWeight: "700", color: colors.ink, letterSpacing: -0.5, textAlign: "center" },
  tag: { marginTop: 8, color: colors.inkSoft, fontSize: 15, textAlign: "center" },
});
