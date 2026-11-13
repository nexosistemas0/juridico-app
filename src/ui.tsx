import React, { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  navy: "#122A35",
  gold: "#B38A4A",
  paper: "#F5F3EE",
  ink: "#20343D",
  muted: "#66777D",
  line: "#DEE3E1",
  white: "#FFFFFF",
  danger: "#A32D32",
};
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || pressed) && { opacity: 0.55 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.navy }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}
export function Muted({ children }: { children: ReactNode }) {
  return <Text style={s.muted}>{children}</Text>;
}
export function Empty({
  text = "Nenhum registro por aqui ainda.",
}: {
  text?: string;
}) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyMark}>MA</Text>
      <Text style={s.muted}>{text}</Text>
    </View>
  );
}
export function Loading() {
  return (
    <View style={s.empty}>
      <ActivityIndicator color={colors.gold} />
      <Muted>Carregando…</Muted>
    </View>
  );
}
export type FieldSpec = {
  name: string;
  label: string;
  required?: boolean;
  secure?: boolean;
  multiline?: boolean;
  keyboard?: "default" | "email-address" | "phone-pad" | "numeric";
  options?: { value: string; label: string }[];
  placeholder?: string;
};
export function Fields({
  fields,
  values,
  setValues,
}: {
  fields: FieldSpec[];
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
}) {
  return (
    <>
      {fields.map((f) => (
        <View key={f.name} style={s.field}>
          <Text style={s.label}>
            {f.label}
            {f.required ? " *" : ""}
          </Text>
          {f.options ? (
            <View style={s.choices}>
              {f.options.map((o) => (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: values[f.name] === o.value }}
                  onPress={() => setValues({ ...values, [f.name]: o.value })}
                  style={[s.choice, values[f.name] === o.value && s.selected]}
                >
                  <Text
                    style={[
                      s.choiceText,
                      values[f.name] === o.value && { color: colors.white },
                    ]}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <TextInput
              accessibilityLabel={f.label}
              style={[
                s.input,
                f.multiline && { minHeight: 100, textAlignVertical: "top" },
              ]}
              placeholder={f.placeholder}
              placeholderTextColor={colors.muted}
              value={values[f.name] || ""}
              onChangeText={(v) => setValues({ ...values, [f.name]: v })}
              secureTextEntry={f.secure}
              autoCapitalize={
                f.secure || f.keyboard === "email-address"
                  ? "none"
                  : "sentences"
              }
              autoCorrect={!f.secure && f.keyboard !== "email-address"}
              keyboardType={f.keyboard || "default"}
              multiline={f.multiline}
              maxLength={f.secure ? 72 : f.multiline ? 10000 : 300}
            />
          )}
        </View>
      ))}
    </>
  );
}
export function FormModal({
  title,
  fields,
  initial = {},
  onSave,
  onClose,
}: {
  title: string;
  fields: FieldSpec[];
  initial?: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    const missing = fields.find((f) => f.required && !values[f.name]?.trim());
    if (missing) {
      setError(`Preencha ${missing.label.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(values);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={s.screen}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            <Muted>MARTINS ADVOGADOS</Muted>
            <Title>{title}</Title>
            <Fields fields={fields} values={values} setValues={setValues} />
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <Button
              label={busy ? "Salvando…" : "Salvar"}
              disabled={busy}
              onPress={submit}
            />
            <Button
              label="Cancelar"
              secondary
              disabled={busy}
              onPress={onClose}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export const s = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 22, gap: 16, paddingBottom: 38 },
  header: { backgroundColor: colors.navy, padding: 22, gap: 8 },
  brand: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  eyebrow: {
    color: "#D9C49F",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: { fontSize: 17, fontWeight: "600", color: colors.ink },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  button: {
    backgroundColor: colors.navy,
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.white, fontWeight: "600", fontSize: 15 },
  secondary: {
    backgroundColor: "#E7ECE9",
    borderWidth: 1,
    borderColor: colors.line,
  },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#CDD7D4",
    borderRadius: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    padding: 14,
    fontSize: 16,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  choiceText: { color: colors.ink, fontSize: 14 },
  selected: { backgroundColor: colors.navy, borderColor: colors.navy },
  error: {
    color: colors.danger,
    lineHeight: 21,
    padding: 12,
    backgroundColor: "#FBE9E7",
    borderRadius: 10,
  },
  empty: { padding: 30, alignItems: "center", gap: 16 },
  emptyMark: { color: colors.gold, fontSize: 28, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#EAF0EB",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 12, color: "#385B47", fontWeight: "600" },
  nav: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 5,
  },
  navItem: {
    flex: 1,
    minHeight: 59,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  navIcon: { fontSize: 20, color: colors.muted },
  navText: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  stat: { fontSize: 34, fontWeight: "700", color: colors.navy },
  bubble: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    marginBottom: 10,
    maxWidth: "90%",
    borderWidth: 1,
    borderColor: colors.line,
  },
  mine: { alignSelf: "flex-end", backgroundColor: "#E4EDE8" },
  link: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: "600",
    paddingVertical: 10,
  },
});
