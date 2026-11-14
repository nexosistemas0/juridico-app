import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  api,
  ApiError,
  clearSession,
  restoreSession,
  saveSession,
  setExpiredHandler,
  shareDocument,
} from "./api";
import { activationToken, cnj, formatDate, type Row } from "./domain";
import {
  Button,
  Card,
  colors,
  Empty,
  Fields,
  FormModal,
  Loading,
  Muted,
  s,
  Title,
  type FieldSpec,
} from "./ui";
const nameField: FieldSpec = {
  name: "name",
  label: "Nome completo",
  required: true,
};
const emailField: FieldSpec = {
  name: "email",
  label: "E-mail",
  keyboard: "email-address",
  required: true,
};
const passwordField: FieldSpec = {
  name: "password",
  label: "Senha (mínimo 10 caracteres)",
  secure: true,
  required: true,
};
const phoneField: FieldSpec = {
  name: "phone",
  label: "Telefone",
  keyboard: "phone-pad",
};
const dateField: FieldSpec = {
  name: "date",
  label: "Data (AAAA-MM-DD)",
  placeholder: "2027-01-20",
  required: true,
};
const movementFields: FieldSpec[] = [
  { name: "title", label: "Título", required: true },
  dateField,
  {
    name: "description",
    label: "Orientação ao cliente",
    multiline: true,
    required: true,
  },
];
const hearingFields: FieldSpec[] = [
  { name: "type", label: "Tipo de audiência", required: true },
  dateField,
  {
    name: "hour",
    label: "Horário de Brasília (HH:MM)",
    placeholder: "14:30",
    required: true,
  },
  { name: "place", label: "Local" },
  { name: "room", label: "Sala" },
  { name: "meeting_link", label: "Link da sala virtual (HTTPS)" },
  { name: "guidelines", label: "Orientações", multiline: true },
];
const initialStrings = (row: Row, fields: FieldSpec[]) =>
  Object.fromEntries(
    fields.map((f) => [
      f.name,
      f.name === "date"
        ? String(row[f.name] || "").slice(0, 10)
        : f.name === "hour"
          ? String(row[f.name] || "").slice(0, 5)
          : String(row[f.name] || ""),
    ]),
  );
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}
function Root() {
  const [user, setUser] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [invitation, setInvitation] = useState("");
  const boot = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      if (await restoreSession()) setUser(await api("/auth/me"));
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setExpiredHandler(() => {
      setUser(null);
      setInvitation("");
    });
    boot();
    const receive = (url: string) => {
      if (!url.startsWith("martinsadvogados://ativar")) return;
      try {
        setInvitation(activationToken(url));
      } catch {
        Alert.alert("Convite inválido", "Solicite um novo link ao advogado.");
      }
    };
    Linking.getInitialURL()
      .then((url) => {
        if (url) receive(url);
      })
      .catch(() => {});
    const sub = Linking.addEventListener("url", (e) => receive(e.url));
    return () => {
      sub.remove();
      setExpiredHandler(() => {});
    };
  }, [boot]);
  if (loading)
    return (
      <SafeAreaView style={s.screen}>
        <Loading />
      </SafeAreaView>
    );
  if (error)
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.content}>
          <Title>Martins Advogados</Title>
          <Text style={s.error}>{error}</Text>
          <Button label="Tentar novamente" onPress={boot} />
          <Button
            label="Voltar ao login"
            secondary
            onPress={() => {
              clearSession()
                .then(() => {
                  setUser(null);
                  setError("");
                })
                .catch((e) => setError(e.message));
            }}
          />
        </View>
      </SafeAreaView>
    );
  if (!user)
    return (
      <Auth
        key={invitation}
        invitation={invitation}
        onLogin={(u) => {
          setInvitation("");
          setUser(u);
        }}
      />
    );
  return (
    <Portal
      key={user.id}
      user={user}
      updateUser={setUser}
      onLogout={() => setUser(null)}
    />
  );
}
function Auth({
  invitation,
  onLogin,
}: {
  invitation: string;
  onLogin: (u: Row) => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "activate">(
      invitation ? "activate" : "login",
    ),
    [values, setValues] = useState<Record<string, string>>({
      token: invitation,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fields =
    mode === "activate"
      ? [
          { name: "token", label: "Link ou código do convite", required: true },
          passwordField,
        ]
      : mode === "register"
        ? [
            nameField,
            emailField,
            passwordField,
            { name: "oab", label: "OAB / UF", required: true },
            phoneField,
          ]
        : [emailField, { ...passwordField, label: "Senha" }];
  async function submit() {
    if (fields.some((f) => f.required && !values[f.name]?.trim())) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api(
        `/auth/${mode}`,
        "POST",
        mode === "activate"
          ? { token: activationToken(values.token), password: values.password }
          : values,
      );
      await saveSession(result.sessionToken);
      onLogin(await api("/auth/me"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView
      style={[s.screen, { backgroundColor: colors.navy }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={[s.header, { paddingVertical: 38 }]}>
            <Text style={s.eyebrow}>SEU ESCRITÓRIO, MAIS PERTO</Text>
            <Text style={[s.brand, { fontSize: 34 }]}>
              Martins{"\n"}Advogados
            </Text>
            <Text style={{ color: "#C8D5D7", lineHeight: 23, marginTop: 12 }}>
              Clareza em cada etapa.{"\n"}Confiança em cada conversa.
            </Text>
          </View>
          <View
            style={[
              s.content,
              {
                backgroundColor: colors.paper,
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
                flex: 1,
              },
            ]}
          >
            <Title>
              {mode === "login"
                ? "Bem-vindo de volta"
                : mode === "register"
                  ? "Cadastro do advogado"
                  : "Ative seu acesso"}
            </Title>
            <Muted>
              {mode === "activate"
                ? "Cole o convite do seu advogado e crie sua senha."
                : "Acompanhe processos e mantenha tudo ao seu alcance."}
            </Muted>
            <Fields fields={fields} values={values} setValues={setValues} />
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <Button
              disabled={busy}
              label={
                busy
                  ? "Aguarde…"
                  : mode === "login"
                    ? "Entrar"
                    : mode === "register"
                      ? "Criar conta"
                      : "Ativar conta"
              }
              onPress={submit}
            />
            {(["login", "activate", "register"] as const)
              .filter((m) => m !== mode)
              .map((m) => (
                <Button
                  key={m}
                  secondary
                  disabled={busy}
                  label={
                    m === "login"
                      ? "Já tenho conta"
                      : m === "activate"
                        ? "Sou cliente · tenho um convite"
                        : "Cadastrar advogado"
                  }
                  onPress={() => {
                    setMode(m);
                    setError("");
                    setValues({ token: invitation });
                  }}
                />
              ))}
            <Muted>
              Seu acesso é pessoal. O cliente é cadastrado pelo advogado antes
              de ativar a conta.
            </Muted>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
type FormState = {
  title: string;
  fields: FieldSpec[];
  initial?: Record<string, string>;
  save: (v: Record<string, string>) => Promise<void>;
};
type Page =
  | "home"
  | "processes"
  | "hearings"
  | "messages"
  | "more"
  | "clients"
  | "notifications"
  | "account";
const tabs: { id: Page; label: string; mark: string }[] = [
  { id: "home", label: "Início", mark: "⌂" },
  { id: "processes", label: "Processos", mark: "▤" },
  { id: "hearings", label: "Agenda", mark: "◷" },
  { id: "messages", label: "Conversas", mark: "✉" },
  { id: "more", label: "Mais", mark: "•••" },
];
function Portal({
  user,
  updateUser,
  onLogout,
}: {
  user: Row;
  updateUser: (u: Row) => void;
  onLogout: () => void;
}) {
  const lawyer = user.type === "adv";
  const [page, setPage] = useState<Page>("home"),
    [processes, setProcesses] = useState<Row[]>([]),
    [hearings, setHearings] = useState<Row[]>([]),
    [clients, setClients] = useState<Row[]>([]),
    [notifications, setNotifications] = useState<Row[]>([]),
    [detail, setDetail] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [form, setForm] = useState<FormState | null>(null),
    [tribunals, setTribunals] = useState<string[]>([]),
    [selected, setSelected] = useState<Row | null>(null),
    [messages, setMessages] = useState<Row[]>([]),
    [message, setMessage] = useState(""),
    [chatLoading, setChatLoading] = useState(false);
  const chatScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const activeChat = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    const [p, h, n, c] = await Promise.all([
      api<Row[]>("/processes"),
      api<Row[]>("/hearings"),
      api<Row[]>("/notifications"),
      lawyer ? api<Row[]>("/clients") : Promise.resolve([]),
    ]);
    setProcesses(p);
    setHearings(h);
    setNotifications(n);
    setClients(c);
  }, [lawyer]);
  const refreshDetail = async (id: number) => {
    setDetail(await api(`/processes/${id}`));
    await refresh();
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    api<string[]>("/tribunals")
      .then(setTribunals)
      .catch(() => {});
  }, [refresh]);
  const go = (next: Page) => {
    setPage(next);
    setDetail(null);
    setSelected(null);
    setMessages([]);
    setQuery("");
    setError("");
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (form) {
        setForm(null);
        return true;
      }
      if (detail) {
        setDetail(null);
        return true;
      }
      if (selected) {
        setSelected(null);
        return true;
      }
      if (page !== "home") {
        go("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [form, detail, selected, page]);
  useEffect(() => {
    if (page !== "messages" || !selected) {
      activeChat.current = null;
      return;
    }
    activeChat.current = selected.id;
    let live = true;
    setMessages([]);
    setChatLoading(true);
    const read = async () => {
      try {
        const rows = await api<Row[]>(`/processes/${selected.id}/messages`);
        if (live)
          setMessages((prev) => {
            const ids = new Set(rows.map((m) => m.id));
            return [...prev.filter((m) => !ids.has(m.id)), ...rows];
          });
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setChatLoading(false);
      }
    };
    read();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") read();
    }, 10000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });
    return () => {
      live = false;
      clearInterval(timer);
      sub.remove();
      activeChat.current = null;
    };
  }, [page, selected?.id]);
  const openProcess = (p: Row) =>
    run(async () => {
      setDetail(await api(`/processes/${p.id}`));
      setPage("processes");
    });
  const chat = (p: Row) => {
    setSelected(p);
    setPage("messages");
    setDetail(null);
    setMessage("");
    setError("");
  };
  const confirmDelete = (title: string, path: string, id?: number) =>
    Alert.alert(title, "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () =>
          run(async () => {
            await api(path, "DELETE");
            if (id) await refreshDetail(id);
            else await refresh();
          }),
      },
    ]);
  const shareInvite = async (result: Row) => {
    const t = activationToken(result.activationPath);
    await Share.share({
      message: `Martins Advogados — ative sua conta no aplicativo.\nAbra: martinsadvogados://ativar?token=${t}\nOu toque em “Sou cliente · tenho um convite” e cole este código:\n${t}\nConvite pessoal, válido por 7 dias.`,
    });
  };
  const clientForm = (row?: Row) => {
    const fields = row
      ? [nameField, phoneField, { name: "address", label: "Endereço" }]
      : [
          nameField,
          emailField,
          phoneField,
          {
            name: "cpf",
            label: "CPF (11 dígitos)",
            keyboard: "numeric" as const,
            required: true,
          },
          { ...dateField, label: "Nascimento (AAAA-MM-DD)" },
          { name: "address", label: "Endereço" },
        ];
    setForm({
      title: row ? "Editar cliente" : "Cadastrar cliente",
      fields,
      initial: row ? initialStrings(row, fields) : {},
      save: async (v) => {
        const r = await api(
          row ? `/clients/${row.id}` : "/clients",
          row ? "PATCH" : "POST",
          v,
        );
        await refresh();
        if (!row) {
          setForm(null);
          await shareInvite(r);
        }
      },
    });
  };
  const processForm = (found?: Row) => {
    if (!clients.length) {
      Alert.alert(
        "Cadastre um cliente",
        "O processo precisa estar vinculado a um cliente.",
      );
      go("clients");
      return;
    }
    const fields: FieldSpec[] = [
      { name: "process_num", label: "Número CNJ", required: true },
      { name: "title", label: "Título para o cliente", required: true },
      {
        name: "id_costumer",
        label: "Cliente",
        required: true,
        options: clients.map((c) => ({ value: String(c.id), label: c.name })),
      },
      {
        name: "tribunal",
        label: "Tribunal (ex.: tjrs, trf4)",
        placeholder: "Identificado pelo número CNJ",
      },
      { name: "court", label: "Órgão julgador" },
      { name: "area", label: "Área" },
      {
        name: "observations",
        label: "Orientações ao cliente",
        multiline: true,
      },
    ];
    setForm({
      title: "Vincular processo",
      fields,
      initial: found
        ? {
            process_num: found.number,
            title: found.className,
            tribunal: found.tribunal,
            court: found.court,
          }
        : {},
      save: async (v) => {
        const data = {
          ...v,
          id_costumer: Number(v.id_costumer),
          tribunal: v.tribunal?.trim().toLowerCase() || undefined,
        };
        await api("/processes", "POST", data);
        await refresh();
      },
    });
  };
  const searchProcess = () =>
    setForm({
      title: "Consultar DataJud",
      fields: [
        { name: "number", label: "Número CNJ", required: true },
        {
          name: "tribunal",
          label: "Tribunal (opcional)",
          placeholder: "Ex.: tjrs; deixe vazio para identificar",
        },
      ],
      save: async (v) => {
        const alias = v.tribunal?.trim().toLowerCase();
        if (alias && tribunals.length && !tribunals.includes(alias))
          throw new Error("Tribunal inválido. Exemplo: tjrs, trf4 ou trt4.");
        const result = await api("/processes/search", "POST", {
          number: v.number,
          tribunal: alias || undefined,
        });
        setForm(null);
        Alert.alert(
          result.className || "Processo encontrado",
          `${result.court}\n${result.movements.length} movimentações públicas. Fonte: CNJ / DataJud.`,
          [
            { text: "Fechar" },
            { text: "Vincular", onPress: () => processForm(result) },
          ],
        );
      },
    });
  const editProcess = () => {
    if (!detail) return;
    const fields: FieldSpec[] = [
      { name: "title", label: "Título", required: true },
      {
        name: "status",
        label: "Situação",
        required: true,
        options: ["Em andamento", "Aguardando", "Concluído", "Arquivado"].map(
          (v) => ({ value: v, label: v }),
        ),
      },
      { name: "area", label: "Área" },
      { name: "court", label: "Órgão julgador" },
      {
        name: "observations",
        label: "Orientações ao cliente",
        multiline: true,
      },
    ];
    setForm({
      title: "Editar processo",
      fields,
      initial: initialStrings(detail, fields),
      save: async (v) => {
        await api(`/processes/${detail.id}`, "PATCH", v);
        await refreshDetail(detail.id);
      },
    });
  };
  const eventForm = (kind: "hearings" | "movements", row?: Row) => {
    if (!detail) return;
    const p = detail;
    const fields = kind === "hearings" ? hearingFields : movementFields;
    setForm({
      title:
        kind === "hearings"
          ? row
            ? "Editar audiência"
            : "Agendar audiência"
          : row
            ? "Editar orientação"
            : "Nova orientação",
      fields,
      initial: row ? initialStrings(row, fields) : {},
      save: async (v) => {
        await api(
          row ? `/${kind}/${row.id}` : `/processes/${p.id}/${kind}`,
          row ? "PATCH" : "POST",
          v,
        );
        await refreshDetail(p.id);
      },
    });
  };
  const upload = () =>
    run(async () => {
      if (!detail) return;
      const pick = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/png", "image/jpeg"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (pick.canceled) return;
      const file = pick.assets[0];
      try {
        if (file.size && file.size > 5 * 1024 * 1024)
          throw new Error("O arquivo deve ter até 5 MB.");
        const data = new FormData();
        data.append("name", file.name);
        data.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || "application/octet-stream",
        } as any);
        await api(`/processes/${detail.id}/documents`, "POST", data);
        await refreshDetail(detail.id);
      } finally {
        await FileSystem.deleteAsync(file.uri, { idempotent: true });
      }
    });
  const filtered = processes.filter((p) =>
    `${p.title} ${p.process_num} ${cnj(p.process_num)} ${p.client_name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const upcoming = hearings.filter(
    (h) =>
      !h.cancelled_at && new Date(
        `${h.date?.slice(0, 10)}T${h.hour || "00:00:00"}-03:00`,
      ).getTime() >= Date.now(),
  );
  const unread = notifications.filter((n) => !n.read).length;
  const processCards = (rows: Row[], forChat = false) =>
    rows.length ? (
      rows.map((p) => (
        <Pressable
          accessibilityRole="button"
          key={p.id}
          onPress={() => (forChat ? chat(p) : openProcess(p))}
        >
          <Card>
            <View style={s.badge}>
              <Text style={s.badgeText}>{p.status}</Text>
            </View>
            <Text style={s.subtitle}>{p.title}</Text>
            <Muted>{cnj(p.process_num)}</Muted>
            <Text style={s.body}>{lawyer ? p.client_name : p.lawyer_name}</Text>
            <Text style={s.link}>
              {forChat ? "Abrir conversa →" : "Acompanhar processo →"}
            </Text>
          </Card>
        </Pressable>
      ))
    ) : (
      <Empty text="Nenhum processo encontrado." />
    );
  const hearingCard = (h: Row, editable = false) => (
    <Card key={h.id}>
      <Text style={s.eyebrow}>AUDIÊNCIA</Text>
      <Text style={s.subtitle}>{h.type}{h.cancelled_at ? " · Cancelada" : ""}</Text>
      <Text style={s.body}>
        {formatDate(h.date)} · {h.hour?.slice(0, 5)} (Brasília)
      </Text>
      <Muted>{h.process_title || detail?.title}</Muted>
      <Text style={s.body}>
        {[h.place, h.room && `Sala ${h.room}`].filter(Boolean).join(" · ") ||
          "Local a confirmar"}
      </Text>
      {!!h.guidelines && <Muted>{h.guidelines}</Muted>}
      {!!h.meeting_link && (
        <Button
          secondary
          label="Abrir sala virtual"
          onPress={() =>
            run(async () => {
              if (!/^https:\/\//i.test(h.meeting_link))
                throw new Error("Link inválido.");
              await Linking.openURL(h.meeting_link);
            })
          }
        />
      )}{" "}
      {editable && lawyer && !h.cancelled_at && (
        <>
          <Button
            secondary
            label="Editar audiência"
            onPress={() => eventForm("hearings", h)}
          />
          <Button
            secondary
            label="Cancelar audiência"
            onPress={() =>
              confirmDelete(
                "Cancelar audiência?",
                `/hearings/${h.id}`,
                detail?.id,
              )
            }
          />
        </>
      )}
    </Card>
  );
  return (
    <SafeAreaView
      style={[s.screen, { backgroundColor: colors.navy }]}
      edges={["top", "bottom"]}
    >
      <View style={s.header}>
        <View style={s.between}>
          <View>
            <Text style={s.eyebrow}>SEU PORTAL JURÍDICO</Text>
            <Text style={s.brand}>Martins Advogados</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Notificações, ${unread} não lidas`}
            onPress={() => go("notifications")}
            style={{ padding: 12 }}
          >
            <Text style={{ color: colors.white, fontWeight: "700" }}>
              ● {unread}
            </Text>
          </Pressable>
        </View>
      </View>
      <KeyboardAvoidingView
        style={[s.flex, { backgroundColor: colors.paper }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {page === "messages" && selected ? (
          <>
            <View style={{ padding: 16, gap: 8 }}>
              <Button
                secondary
                label="← Todas as conversas"
                onPress={() => setSelected(null)}
              />
              <Text style={s.subtitle}>{selected.title}</Text>
            </View>
            <ScrollView
              ref={chatScroll}
              contentContainerStyle={{ padding: 18 }}
              keyboardShouldPersistTaps="handled"
            >
              {!!error && <Text style={s.error}>{error}</Text>}
              {chatLoading ? (
                <Loading />
              ) : !messages.length ? (
                <Empty text="Comece uma conversa com uma mensagem." />
              ) : (
                <Button
                  secondary
                  label="Carregar mensagens anteriores"
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      const id = selected.id;
                      const older = await api<Row[]>(
                        `/processes/${id}/messages?before=${messages[0].id}`,
                      );
                      if (activeChat.current !== id) return;
                      if (!older.length) {
                        Alert.alert("Conversas", "Você chegou ao início.");
                        return;
                      }
                      setMessages((prev) => {
                        const ids = new Set(prev.map((m) => m.id));
                        return [
                          ...older.filter((m) => !ids.has(m.id)),
                          ...prev,
                        ];
                      });
                    })
                  }
                />
              )}{" "}
              {messages.map((m) => (
                <View
                  key={m.id}
                  style={[s.bubble, m.id_sender === user.id && s.mine]}
                >
                  <Text style={s.label}>{m.sender_name || user.name}</Text>
                  <Text selectable style={s.body}>
                    {m.body}
                  </Text>
                  <Muted>{formatDate(m.created_at)}</Muted>
                </View>
              ))}
            </ScrollView>
            <View
              style={{
                padding: 14,
                gap: 10,
                borderTopWidth: 1,
                borderColor: colors.line,
              }}
            >
              <TextInput
                accessibilityLabel="Mensagem"
                placeholder="Escreva sua mensagem…"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={5000}
                style={[s.input, { maxHeight: 120 }]}
              />
              <Button
                label={busy ? "Enviando…" : "Enviar mensagem"}
                disabled={busy || !message.trim()}
                onPress={() =>
                  run(async () => {
                    const id = selected.id;
                    await api(`/processes/${id}/messages`, "POST", {
                      body: message.trim(),
                    });
                    if (activeChat.current !== id) return;
                    setMessage("");
                    setMessages(await api(`/processes/${id}/messages`));
                    chatScroll.current?.scrollToEnd({ animated: true });
                  })
                }
              />
            </View>
          </>
        ) : (
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={busy}
                onRefresh={() =>
                  run(async () => {
                    if (detail) await refreshDetail(detail.id);
                    else await refresh();
                  })
                }
                tintColor={colors.gold}
              />
            }
          >
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            {loading ? (
              <Loading />
            ) : page === "home" ? (
              <>
                <Muted>{lawyer ? "ÁREA DO ADVOGADO" : "ÁREA DO CLIENTE"}</Muted>
                <Title>Olá, {user.name.split(" ")[0]}.</Title>
                <Muted>Seu acompanhamento, com clareza e proximidade.</Muted>
                <View style={s.row}>
                  <View style={s.flex}>
                    <Card>
                      <Text style={s.stat}>{processes.length}</Text>
                      <Muted>Processos</Muted>
                    </Card>
                  </View>
                  <View style={s.flex}>
                    <Card>
                      <Text style={s.stat}>{upcoming.length}</Text>
                      <Muted>Audiências futuras</Muted>
                    </Card>
                  </View>
                </View>
                {lawyer && (
                  <Button
                    label="Cadastrar cliente"
                    onPress={() => clientForm()}
                  />
                )}
                <Text style={s.subtitle}>Próximos compromissos</Text>
                {upcoming.length ? (
                  upcoming.slice(0, 3).map((h) => hearingCard(h))
                ) : (
                  <Empty text="Nenhuma audiência futura cadastrada." />
                )}
                <Text style={s.subtitle}>Seus processos</Text>
                {processCards(processes.slice(0, 4))}
              </>
            ) : null}
            {!loading && page === "processes" && !detail && (
              <>
                <Title>Processos</Title>
                <TextInput
                  accessibilityLabel="Buscar processo"
                  placeholder="Buscar por número, título ou cliente"
                  value={query}
                  onChangeText={setQuery}
                  style={s.input}
                />
                {lawyer && (
                  <>
                    <Button
                      label="Consultar número no DataJud"
                      onPress={searchProcess}
                    />
                    <Button
                      secondary
                      label="Vincular processo manualmente"
                      onPress={() => processForm()}
                    />
                  </>
                )}
                {processCards(filtered)}
              </>
            )}
            {!loading && page === "processes" && detail && (
              <>
                <Button
                  secondary
                  label="← Voltar aos processos"
                  onPress={() => setDetail(null)}
                />
                <Title>{detail.title}</Title>
                <Muted>{cnj(detail.process_num)}</Muted>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{detail.status}</Text>
                </View>
                <Card>
                  <Text style={s.subtitle}>Acompanhamento</Text>
                  <Text style={s.body}>
                    {detail.court || "Órgão não informado"}
                  </Text>
                  <Muted>{detail.area || "Área não informada"}</Muted>
                  {!!detail.observations && (
                    <Text style={s.body}>{detail.observations}</Text>
                  )}
                  <Muted>
                    Última consulta ao CNJ:{" "}
                    {formatDate(detail.datajud_checked_at)}
                  </Muted>
                  <Muted>
                    Atualização na fonte:{" "}
                    {formatDate(detail.datajud_updated_at)}
                  </Muted>
                  <Muted>
                    A base pública pode ter atraso ou não disponibilizar o
                    processo. As consultas são feitas pelo advogado.
                  </Muted>
                </Card>
                <Button
                  label="Conversar sobre este processo"
                  onPress={() => chat(detail)}
                />
                {lawyer && (
                  <>
                    <Button
                      secondary
                      label="Editar processo"
                      onPress={editProcess}
                    />
                    <Button
                      secondary
                      disabled={busy}
                      label="Consultar DataJud e importar"
                      onPress={() =>
                        run(async () => {
                          const result = await api(
                            `/processes/${detail.id}/sync`,
                            "POST",
                            {},
                          );
                          await refreshDetail(detail.id);
                          Alert.alert(
                            "Consulta concluída",
                            `${result.inserted} novas movimentações importadas.`,
                          );
                        })
                      }
                    />
                  </>
                )}
                <Text style={s.subtitle}>Movimentações</Text>
                {lawyer && (
                  <Button
                    secondary
                    label="Adicionar orientação"
                    onPress={() => eventForm("movements")}
                  />
                )}{" "}
                {!detail.movements?.length && (
                  <Empty text="Sem movimentações cadastradas." />
                )}
                {detail.movements?.map((m: Row) => (
                  <Card key={m.id}>
                    <Muted>
                      {formatDate(m.source_occurred_at || m.date)} ·{" "}
                      {m.source === "datajud" ? "CNJ / DataJud" : "Advogado"}
                    </Muted>
                    <Text style={s.subtitle}>{m.title}</Text>
                    <Text style={s.body}>{m.description}</Text>
                    {lawyer && m.source !== "datajud" && (
                      <>
                        <Button
                          secondary
                          label="Editar orientação"
                          onPress={() => eventForm("movements", m)}
                        />
                        <Button
                          secondary
                          label="Excluir orientação"
                          onPress={() =>
                            confirmDelete(
                              "Excluir orientação?",
                              `/movements/${m.id}`,
                              detail.id,
                            )
                          }
                        />
                      </>
                    )}
                  </Card>
                ))}
                <Text style={s.subtitle}>Audiências</Text>
                {lawyer && (
                  <Button
                    secondary
                    label="Agendar audiência"
                    onPress={() => eventForm("hearings")}
                  />
                )}{" "}
                {!detail.hearings?.length && (
                  <Empty text="Sem audiências cadastradas." />
                )}
                {detail.hearings?.map((h: Row) => hearingCard(h, true))}
                <Text style={s.subtitle}>Documentos</Text>
                {lawyer && (
                  <Button
                    secondary
                    label="Enviar PDF ou imagem"
                    disabled={busy}
                    onPress={upload}
                  />
                )}{" "}
                {!detail.documents?.length && (
                  <Empty text="Sem documentos compartilhados." />
                )}
                {detail.documents?.map((d: Row) => (
                  <Card key={d.id}>
                    <Text style={s.subtitle}>{d.name}</Text>
                    <Muted>
                      {d.status} · {formatDate(d.date_sed)}
                    </Muted>
                    <Button
                      secondary
                      label="Abrir ou compartilhar documento"
                      disabled={busy}
                      onPress={() => run(() => shareDocument(d.id, d.name))}
                    />
                    {lawyer && (
                      <Button
                        secondary
                        label="Excluir documento"
                        onPress={() =>
                          confirmDelete(
                            "Excluir documento?",
                            `/documents/${d.id}`,
                            detail.id,
                          )
                        }
                      />
                    )}
                  </Card>
                ))}
              </>
            )}
            {!loading && page === "hearings" && (
              <>
                <Title>Agenda</Title>
                <Muted>
                  Horários de Brasília. Abra o processo para cadastrar ou editar
                  uma audiência.
                </Muted>
                {hearings.length ? (
                  hearings.map((h) => hearingCard(h))
                ) : (
                  <Empty text="Nenhuma audiência cadastrada." />
                )}
              </>
            )}
            {!loading && page === "messages" && !selected && (
              <>
                <Title>Conversas</Title>
                <Muted>
                  Escolha o processo para conversar com{" "}
                  {lawyer ? "seu cliente" : "seu advogado"}.
                </Muted>
                {processCards(processes, true)}
              </>
            )}
            {!loading && page === "clients" && lawyer && (
              <>
                <Title>Clientes</Title>
                <Button
                  label="Cadastrar cliente"
                  onPress={() => clientForm()}
                />
                {!clients.length && (
                  <Empty text="Cadastre seu primeiro cliente." />
                )}
                {clients.map((c) => (
                  <Card key={c.id}>
                    <Text style={s.subtitle}>{c.name}</Text>
                    <Muted>{c.email}</Muted>
                    <Text style={s.body}>
                      {c.phone || "Telefone não informado"}
                    </Text>
                    <Text style={s.badgeText}>
                      {c.activated ? "Conta ativada" : "Ativação pendente"}
                    </Text>
                    <Button
                      secondary
                      label="Editar cliente"
                      onPress={() => clientForm(c)}
                    />
                    {!c.activated && (
                      <Button
                        secondary
                        label="Gerar e compartilhar novo convite"
                        disabled={busy}
                        onPress={() =>
                          run(async () =>
                            shareInvite(
                              await api(`/clients/${c.id}/invite`, "POST", {}),
                            ),
                          )
                        }
                      />
                    )}
                  </Card>
                ))}
              </>
            )}
            {!loading && page === "notifications" && (
              <>
                <Title>Notificações</Title>
                {!notifications.length && <Empty text="Nenhuma notificação." />}
                {notifications.map((n) => (
                  <Card key={n.id}>
                    <Text style={s.subtitle}>
                      {!n.read ? "● " : ""}
                      {n.title}
                    </Text>
                    <Text style={s.body}>{n.description}</Text>
                    <Muted>{formatDate(n.created_at || n.date)}</Muted>
                    {!n.read && (
                      <Button
                        secondary
                        label="Marcar como lida"
                        onPress={() =>
                          run(async () => {
                            await api(
                              `/notifications/${n.id}/read`,
                              "PATCH",
                              {},
                            );
                            await refresh();
                          })
                        }
                      />
                    )}
                    <Button
                      secondary
                      label="Excluir notificação"
                      onPress={() =>
                        confirmDelete(
                          "Excluir notificação?",
                          `/notifications/${n.id}`,
                        )
                      }
                    />
                  </Card>
                ))}
              </>
            )}
            {!loading && (page === "more" || page === "account") && (
              <>
                <Title>
                  {page === "account" ? "Minha conta" : "Seu espaço"}
                </Title>
                <Card>
                  <Text style={s.subtitle}>{user.name}</Text>
                  <Muted>{user.email}</Muted>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>
                      {lawyer ? "Advogado" : "Cliente"}
                    </Text>
                  </View>
                </Card>
                {lawyer && (
                  <Button
                    secondary
                    label="Gerenciar clientes"
                    onPress={() => go("clients")}
                  />
                )}
                <Button
                  secondary
                  label={`Notificações (${unread} não lidas)`}
                  onPress={() => go("notifications")}
                />
                <Button
                  secondary
                  label="Editar meus dados"
                  onPress={() =>
                    setForm({
                      title: "Meus dados",
                      fields: [nameField, phoneField],
                      initial: { name: user.name, phone: user.phone || "" },
                      save: async (v) => {
                        await api("/account", "PATCH", v);
                        updateUser(await api("/auth/me"));
                      },
                    })
                  }
                />
                <Button
                  secondary
                  label="Alterar senha"
                  onPress={() =>
                    setForm({
                      title: "Alterar senha",
                      fields: [
                        {
                          name: "currentPassword",
                          label: "Senha atual",
                          secure: true,
                          required: true,
                        },
                        passwordField,
                      ],
                      save: async (v) => {
                        const result = await api(
                          "/account/password",
                          "POST",
                          v,
                        );
                        await saveSession(result.sessionToken);
                        Alert.alert(
                          "Senha alterada",
                          "As sessões anteriores foram encerradas.",
                        );
                      },
                    })
                  }
                />
                <Button
                  label="Sair da conta"
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      await api("/auth/logout", "POST", {});
                      await clearSession();
                      onLogout();
                    })
                  }
                />
                <Muted>Martins Advogados · Versão 1.0.0</Muted>
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <View style={s.nav}>
        {tabs.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: page === t.id }}
            accessibilityLabel={t.label}
            onPress={() => go(t.id)}
            style={s.navItem}
          >
            <Text style={[s.navIcon, page === t.id && { color: colors.gold }]}>
              {t.mark}
            </Text>
            <Text style={[s.navText, page === t.id && { color: colors.navy }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {form && (
        <FormModal
          key={form.title}
          title={form.title}
          fields={form.fields}
          initial={form.initial}
          onSave={form.save}
          onClose={() => setForm(null)}
        />
      )}
    </SafeAreaView>
  );
}
