import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiBase } from "./domain";
const KEY = "martins.session.v1";
let token: string | null = null;
let onExpired = () => {};
export function setExpiredHandler(handler: () => void) {
  onExpired = handler;
}
export async function restoreSession() {
  token = await SecureStore.getItemAsync(KEY);
  return !!token;
}
export async function saveSession(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new Error("Sessão inválida recebida do servidor.");
  await SecureStore.setItemAsync(KEY, value);
  token = value;
}
export async function clearSession() {
  token = null;
  await SecureStore.deleteItemAsync(KEY);
}
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const baseURL = () => apiBase(process.env.EXPO_PUBLIC_API_URL, __DEV__);
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const base = baseURL(),
    form = body instanceof FormData,
    controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 25000);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "X-Requested-With": "juridico-app",
        "X-Client-Type": "mobile",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(!form && body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        body === undefined
          ? undefined
          : form
            ? (body as FormData)
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível conectar à API. Confira a rede e o endereço do servidor.",
    );
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 204) return undefined as T;
  const data = await response
    .json()
    .catch(() => ({ message: "Resposta inválida do servidor." }));
  if (!response.ok) {
    if (response.status === 401 && token) {
      await clearSession();
      onExpired();
    }
    throw new ApiError(
      response.status,
      data.message || "Não foi possível concluir.",
    );
  }
  return data;
}
export async function shareDocument(id: number, name: string) {
  if (!token) throw new Error("Entre novamente para abrir o documento.");
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Compartilhamento não disponível.");
  const local = `${FileSystem.cacheDirectory}martins-${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_") || "documento"}`;
  try {
    const result = await FileSystem.downloadAsync(
      `${baseURL()}/documents/${id}/download`,
      local,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (result.status !== 200)
      throw new Error(
        "Não foi possível baixar o documento. Entre novamente e tente outra vez.",
      );
    await Sharing.shareAsync(result.uri, {
      dialogTitle: "Documento — Martins Advogados",
    });
  } finally {
    await FileSystem.deleteAsync(local, { idempotent: true });
  }
}
