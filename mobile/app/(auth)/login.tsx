import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { useAuth } from "@/store/auth.store";
import { errorMessage } from "@/services/api";
import { colors, radius, spacing } from "@/theme";

export default function Login() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    if (!email.trim() || !password) return setErr("Enter your email and password.");
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr(errorMessage(e, "Couldn't sign in. Check your details."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.sub}>Sol saved your space.</Text>

      <View style={{ gap: 12, marginTop: spacing(6) }}>
        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        {err && <Text style={{ color: colors.danger }}>{err}</Text>}
        <Button label="Sign in" onPress={onSubmit} loading={loading} />
        <Pressable onPress={() => router.push("/(auth)/register")}>
          <Text style={styles.link}>New here? Create an account</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing(6), paddingTop: 90 },
  title: { fontSize: 30, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  sub: { color: colors.muted, marginTop: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 16,
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
  },
  link: { color: colors.sage, textAlign: "center", marginTop: 12, fontWeight: "600" },
});