import { test } from "node:test";
import assert from "node:assert/strict";
import { activationToken, apiBase, cnj, formatDate } from "../src/domain.ts";
test("accepts web and native invitation or raw token, rejects malformed input", () => {
  const t = "a".repeat(64);
  for (const v of [
    t,
    `https://portal.example/ativar#${t}`,
    `martinsadvogados://ativar?token=${t}`,
  ])
    assert.equal(activationToken(v), t);
  for (const v of ["", "abc", "https://example/ativar#bad", `x#${t}extra`])
    assert.throws(() => activationToken(v));
});
test("production API requires HTTPS and rejects embedded credentials", () => {
  assert.equal(
    apiBase("http://192.168.1.5:3333/api/", true),
    "http://192.168.1.5:3333/api",
  );
  assert.equal(
    apiBase("https://api.example/api", false),
    "https://api.example/api",
  );
  for (const v of [
    undefined,
    "http://example/api",
    "https://user:password@example/api",
    "https://example/api?token=secret",
  ])
    assert.throws(() => apiBase(v, false));
});
test("formats CNJ and dates without shifting date-only values", () => {
  assert.equal(cnj("00008323520184013202"), "0000832-35.2018.4.01.3202");
  assert.equal(formatDate("2027-01-20"), "20/01/2027");
});
