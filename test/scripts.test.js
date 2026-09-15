"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const LIB = fs.readFileSync(path.join(__dirname, "../src/lib.js"), "utf8");
const BEFORE = fs.readFileSync(path.join(__dirname, "../src/before.js"), "utf8");
const SUCCESS = fs.readFileSync(path.join(__dirname, "../src/success.js"), "utf8");
const FAILURE = fs.readFileSync(path.join(__dirname, "../src/failure.js"), "utf8");

class Aborted extends Error {}

function makeEnv(vars, http) {
  const calls = { http: [], toasts: [], clipboard: [] };
  const env = {
    vars: { ...vars },
    calls,
    getVariable: (k) => {
      if (!(k in env.vars)) throw new Error("unknown variable " + k);
      return env.vars[k];
    },
    setVariable: (k, v) => { env.vars[k] = String(v); },
    sendHttpRequest: (url, opts) => { calls.http.push({ url, opts }); return http(url, opts); },
    showToast: (m) => calls.toasts.push(m),
    copyToClipboard: (t) => calls.clipboard.push(t),
    abort: () => { throw new Aborted(); },
    Date: { now: () => 1_000_000 },
    JSON, String, parseInt, isNaN, RegExp, Object,
  };
  return env;
}

function run(code, env, extra = {}) {
  const scope = { ...env, ...extra };
  const names = Object.keys(scope);
  const fn = new Function(...names, LIB + "\n" + code);
  try {
    fn(...names.map((n) => scope[n]));
    return "completed";
  } catch (e) {
    if (e instanceof Aborted) return "aborted";
    throw e;
  }
}

const BASE_VARS = {
  shared_text: "",
  shared_title: "",
  tumblr_blog: "dlwr",
  tumblr_post_state: "draft",
  tumblr_client_id: "CID",
  tumblr_client_secret: "CSEC",
  tumblr_access_token: "ACCESS",
  tumblr_refresh_token: "REFRESH",
  tumblr_token_expires_at: String(1_000_000 + 3_600_000),
  tumblr_pending: "",
};

const ok = (body) => ({ status: "success", response: { body, statusCode: 200, headers: {} } });

test("before: 共有テキストから post_body を組み、pending に保存する", () => {
  const env = makeEnv(
    { ...BASE_VARS, shared_text: '"本文"\nhttps://ex.com/p#:~:text=x', shared_title: "" },
    (url) => (url === "https://ex.com/p" ? ok("<title>記事 &amp; 題</title>") : ok("{}"))
  );
  assert.equal(run(BEFORE, env), "completed");
  assert.deepEqual(JSON.parse(env.vars.post_body), {
    type: "quote",
    quote: "本文",
    source: '<a href="https://ex.com/p#:~:text=x">記事 &amp; 題</a>',
    state: "draft",
  });
  assert.deepEqual(JSON.parse(env.vars.tumblr_pending), { quote: "本文", url: "https://ex.com/p#:~:text=x", subject: "" });
  assert.equal(env.calls.http.length, 1);
  assert.equal(env.calls.http[0].opts.method, "GET");
});

test("before: subject があればページを GET しない", () => {
  const env = makeEnv({ ...BASE_VARS, shared_text: "本文\nhttps://ex.com/p", shared_title: "題" }, () => { throw new Error("no http"); });
  run(BEFORE, env);
  assert.equal(JSON.parse(env.vars.post_body).source, '<a href="https://ex.com/p">題</a>');
});

test("before: title 取得に失敗したらホスト名", () => {
  const env = makeEnv({ ...BASE_VARS, shared_text: "本文\nhttps://ex.com/p" }, () => ({ status: "networkError", networkError: "off" }));
  run(BEFORE, env);
  assert.equal(JSON.parse(env.vars.post_body).source, '<a href="https://ex.com/p">ex.com</a>');
});

test("before: URL 無しなら source を付けずに投稿する", () => {
  const env = makeEnv({ ...BASE_VARS, shared_text: "本文だけ" }, () => { throw new Error("no http"); });
  run(BEFORE, env);
  assert.deepEqual(JSON.parse(env.vars.post_body), { type: "quote", quote: "本文だけ", state: "draft" });
});

test("before: 本文が空なら Toast を出して中断する", () => {
  const env = makeEnv({ ...BASE_VARS, shared_text: "https://ex.com/p" }, () => ok(""));
  assert.equal(run(BEFORE, env), "aborted");
  assert.equal(env.calls.toasts.length, 1);
  assert.equal("post_body" in env.vars, false);
});

test("before: 共有テキストが空でも pending があればそれを使う", () => {
  const env = makeEnv(
    { ...BASE_VARS, tumblr_pending: JSON.stringify({ quote: "保留", url: "https://ex.com/q", subject: "題" }) },
    () => { throw new Error("no http"); }
  );
  run(BEFORE, env);
  assert.equal(JSON.parse(env.vars.post_body).quote, "保留");
});

test("before: 共有テキストも pending も空なら中断", () => {
  const env = makeEnv({ ...BASE_VARS }, () => ok(""));
  assert.equal(run(BEFORE, env), "aborted");
});

test("before: 期限切れならリフレッシュしてトークンを保存する", () => {
  const env = makeEnv(
    { ...BASE_VARS, shared_text: "本文", tumblr_token_expires_at: "1" },
    (url, opts) => {
      if (url === "https://api.tumblr.com/v2/oauth2/token") {
        assert.deepEqual(opts.formData, { grant_type: "refresh_token", refresh_token: "REFRESH", client_id: "CID", client_secret: "CSEC" });
        return ok(JSON.stringify({ access_token: "A2", refresh_token: "R2", expires_in: 2520 }));
      }
      throw new Error("unexpected " + url);
    }
  );
  assert.equal(run(BEFORE, env), "completed");
  assert.equal(env.vars.tumblr_access_token, "A2");
  assert.equal(env.vars.tumblr_refresh_token, "R2");
  assert.equal(env.vars.tumblr_token_expires_at, String(1_000_000 + 2520 * 1000));
});

test("before: リフレッシュが HTTP エラーなら Toast + クリップボード退避で中断", () => {
  const env = makeEnv(
    { ...BASE_VARS, shared_text: "本文\nhttps://ex.com/p", tumblr_token_expires_at: "1" },
    () => ({ status: "httpError", response: { statusCode: 401, body: '{"error":"invalid_grant"}' } })
  );
  assert.equal(run(BEFORE, env), "aborted");
  assert.match(env.calls.toasts[0], /401/);
  assert.equal(env.calls.clipboard[0], "本文\nhttps://ex.com/p");
});

test("before: リフレッシュがネットワークエラーなら中断せず続行する", () => {
  const env = makeEnv(
    { ...BASE_VARS, shared_text: "本文", tumblr_token_expires_at: "1" },
    () => ({ status: "networkError", networkError: "off" })
  );
  assert.equal(run(BEFORE, env), "completed");
  assert.equal(env.vars.tumblr_access_token, "ACCESS");
  assert.equal(JSON.parse(env.vars.post_body).quote, "本文");
});

test("success: Toast を出して pending を消す", () => {
  const env = makeEnv({ ...BASE_VARS, tumblr_pending: "{}" }, () => ok(""));
  run(SUCCESS, env, { response: { statusCode: 201, body: '{"meta":{"status":201}}' }, networkError: null });
  assert.equal(env.vars.tumblr_pending, "");
  assert.equal(env.calls.toasts.length, 1);
});

test("failure: HTTP エラーはステータスと本文先頭を Toast し、本文と URL を退避する", () => {
  const env = makeEnv(
    { ...BASE_VARS, tumblr_pending: JSON.stringify({ quote: "本文", url: "https://ex.com/p", subject: "" }) },
    () => ok("")
  );
  run(FAILURE, env, { response: { statusCode: 400, body: '{"meta":{"status":400,"msg":"Bad Request"}}' }, networkError: null });
  assert.match(env.calls.toasts[0], /^Tumblr 400 /);
  assert.equal(env.calls.clipboard[0], "本文\nhttps://ex.com/p");
});

test("failure: ネットワークエラーは networkError を Toast する", () => {
  const env = makeEnv({ ...BASE_VARS }, () => ok(""));
  run(FAILURE, env, { response: null, networkError: "Unable to resolve host" });
  assert.match(env.calls.toasts[0], /Unable to resolve host/);
  assert.equal(env.calls.clipboard.length, 0);
});
