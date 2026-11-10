import { View, ViewProps, StyleSheet } from "react-native";
import { colors, radius, shadow } from "@/theme";

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    ...shadow.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
});