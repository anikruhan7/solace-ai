import { useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Dimensions, Pressable,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sol } from "@/components/Sol";
import { Button } from "@/components/Button";
import { colors, spacing } from "@/theme";

const { width } = Dimensions.get("window");

const slides = [
  { title: "Meet Sol", body: "Your gentle AI companion — here to listen, reflect, and support you, one day at a time." },
  { title: "Understand your moods", body: "Check in with how you feel. Small, kind patterns start to appear." },
  { title: "Build calm habits", body: "Breathing exercises, affirmations and tiny self-care moments that actually fit your day." },
  { title: "See your journey", body: "Streaks and gentle insights show how far you've come. Your data stays yours, and you control what Sol uses." },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await AsyncStorage.setItem("solace_onboarded", "1");
    router.replace("/(auth)/login");
  };

  const next = () => {
    if (index === slides.length - 1) return finish();
    listRef.current?.scrollToIndex({ index: index + 1 });
    setIndex(index + 1);
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={finish} style={styles.skip} hitSlop={12}>
        <Text style={{ color: colors.muted }}>Skip</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Sol size={150} />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Button label={index === slides.length - 1 ? "Get started" : "Continue"} onPress={next} style={{ marginHorizontal: spacing(6) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingTop: 60, paddingBottom: 40 },
  skip: { position: "absolute", top: 56, right: 24, zIndex: 2 },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing(8), gap: 16 },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink, textAlign: "center", letterSpacing: -0.3 },
  body: { fontSize: 16, color: colors.inkSoft, textAlign: "center", lineHeight: 24 },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.sage, width: 22 },
});