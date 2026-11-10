import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { useAuth } from "@/store/auth.store";
import { errorMessage } from "@/services/api";
import { colors, radius, spacing } from "@/theme";

export default function Register() {
  const register = useAuth((s) => s.register);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErr(null);
    if (!name.trim()) return setErr("Please tell us what to call you.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Please enter a valid email.");
    if (password.length < 8) return setErr("Password needs at least 8 characters.");
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr(errorMessage(e, "Couldn't create your account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
      <Text style={styles.title}>Create your space</Text>
      <Text style={styles.sub}>A quiet place to check in with yourself.</Text>

      <View style={{ gap: 12, marginTop: spacing(6) }}>
        <TextInput placeholder="Your name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} />
        <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput placeholder="Password (8+ characters)" secureTextEntry placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} style={styles.input} />
        {err && <Text style={{ color: colors.danger }}>{err}</Text>}
        <Button label="Create account" onPress={onSubmit} loading={loading} />
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>I already have an account</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: spacing(6), paddingTop: 90 },
  title: { fontSize: 30, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  sub: { color: colors.muted, marginTop: 6 },
  input: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, fontSize: 16, color: colors.ink, borderWidth: 1, borderColor: colors.border },
  link: { color: colors.sage, textAlign: "center", marginTop: 12, fontWeight: "600" },
});