import { Link } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/AuthContext";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { theme } from "@/shared/theme/theme";

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError("Введите email и пароль.");
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов.");
      return;
    }

    setLoading(true);

    const result = await signUp(trimmedEmail, password);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess("Аккаунт создан. Если включено подтверждение email — проверьте почту, затем войдите.");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>Регистрация</Text>
            <Text style={styles.subtitle}>Создайте аккаунт для хранения своих платежей.</Text>

            <View style={styles.form}>
              <AppTextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                placeholder="you@example.com"
                textContentType="emailAddress"
                value={email}
              />
              <AppTextInput
                autoCapitalize="none"
                autoComplete="password-new"
                label="Пароль"
                onChangeText={setPassword}
                placeholder="Минимум 6 символов"
                secureTextEntry
                textContentType="newPassword"
                value={password}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {success ? <Text style={styles.success}>{success}</Text> : null}

              <AppButton loading={loading} onPress={handleRegister} title="Создать аккаунт" />
            </View>

            <Text style={styles.footer}>
              Уже есть аккаунт?{" "}
              <Link href="/(auth)/login" style={styles.link}>
                Войти
              </Link>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: theme.spacing.xl
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  form: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20
  },
  success: {
    color: theme.colors.primary,
    fontSize: 14,
    lineHeight: 20
  },
  footer: {
    color: theme.colors.textMuted,
    fontSize: 15,
    marginTop: theme.spacing.sm,
    textAlign: "center"
  },
  link: {
    color: theme.colors.primary,
    fontWeight: "600"
  }
});
