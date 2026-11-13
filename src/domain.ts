export function activationToken(value: string): string {
  const text = value.trim();
  const token = /^[a-f0-9]{64}$/.test(text)
    ? text
    : text.includes("#")
      ? text.split("#")[1]
      : /[?&]token=([a-f0-9]{64})(?:&|$)/.exec(text)?.[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new Error("Cole o link completo ou o código enviado pelo advogado.");
  return token;
}
export function apiBase(
  value: string | undefined,
  development: boolean,
): string {
  if (!value)
    throw new Error("Configure EXPO_PUBLIC_API_URL no .env e reinicie o Expo.");
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !["http:", "https:"].includes(u.protocol)
  )
    throw new Error("Endereço da API inválido.");
  if (!development && u.protocol !== "https:")
    throw new Error("Produção exige uma API HTTPS.");
  return value.replace(/\/+$/, "");
}
export const formatDate = (v?: string) =>
  v
    ? new Date(v.length === 10 ? `${v}T12:00:00-03:00` : v).toLocaleDateString(
        "pt-BR",
        { timeZone: "America/Sao_Paulo" },
      )
    : "Não informada";
export const cnj = (v: string) =>
  v?.replace(
    /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,
    "$1-$2.$3.$4.$5.$6",
  ) || v;
export type Row = Record<string, any>;
