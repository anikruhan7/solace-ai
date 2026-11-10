import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "@/theme";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = "primary", disabled, loading, style }: Props) {
  const bg =
    variant === "primary" ? colors.sage : variant === "secondary" ? colors.lavenderSoft : "transparent";
  const fg = variant === "primary" ? colors.white : variant === "secondary" ? colors.lavender : colors.sage;

  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: pressed || disabled ? 0.75 : 1 },
        variant === "ghost" && { borderWidth: 1.5, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: spacing(6),
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 16, fontWeight: "600" },
});