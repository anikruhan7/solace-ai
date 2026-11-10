import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "@/theme";

export type MoodKey =
  | "very_happy" | "happy" | "neutral" | "sad" | "anxious" | "stressed" | "tired";

const MOODS: { key: MoodKey; label: string; emoji: string; color: string }[] = [
  { key: "very_happy", label: "Joyful", emoji: "😊", color: colors.sageSoft },
  { key: "happy", label: "Good", emoji: "🙂", color: colors.sageSoft },
  { key: "neutral", label: "Okay", emoji: "😐", color: colors.blueSoft },
  { key: "sad", label: "Low", emoji: "😔", color: colors.lavenderSoft },
  { key: "anxious", label: "Anxious", emoji: "😟", color: colors.peachSoft },
  { key: "stressed", label: "Stressed", emoji: "😖", color: colors.peachSoft },
  { key: "tired", label: "Tired", emoji: "😴", color: colors.lavenderSoft },
];

export function MoodPicker({
  selected,
  onSelect,
}: {
  selected: MoodKey | null;
  onSelect: (m: MoodKey) => void;
}) {
  return (
    <View style={styles.grid}>
      {MOODS.map((m) => {
        const active = selected === m.key;
        return (
          <Pressable
            key={m.key}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(m.key);
            }}
            style={[
              styles.item,
              { backgroundColor: m.color },
              active && { borderColor: colors.sage, borderWidth: 2 },
            ]}
          >
            <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
            <Text style={styles.label}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2.5) },
  item: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  label: { marginTop: 6, fontSize: 13, fontWeight: "600", color: colors.ink },
});
export function moodLabel(key: string) {
  return MOODS.find((m) => m.key === key)?.label ?? key.replace("_", " ");
}

export function moodEmoji(key: string) {
  return MOODS.find((m) => m.key === key)?.emoji ?? "•";
}
