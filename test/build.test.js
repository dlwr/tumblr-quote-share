"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("../build.js");

test("build: スクリプトが所定のフィールドに埋め込まれる", () => {
  const json = JSON.parse(build());
  const shortcut = json.categories[0].shortcuts[0];
  const lib = fs.readFileSync(path.join(__dirname, "../src/lib.js"), "utf8");
  const before = fs.readFileSync(path.join(__dirname, "../src/before.js"), "utf8");
  assert.equal(shortcut.codeOnPrepare, lib + "\n" + before);
  assert.equal(shortcut.codeOnSuccess, fs.readFileSync(path.join(__dirname, "../src/success.js"), "utf8"));
  assert.equal(shortcut.codeOnFailure, fs.readFileSync(path.join(__dirname, "../src/failure.js"), "utf8"));
});

test("build: 秘密情報の変数は値が空でエクスポート除外フラグが立っている", () => {
  const json = JSON.parse(build());
  const secrets = ["tumblr_client_id", "tumblr_client_secret", "tumblr_access_token", "tumblr_refresh_token"];
  for (const key of secrets) {
    const v = json.variables.find((x) => x.key === key);
    assert.ok(v, key);
    assert.equal(v.value, "", key);
    assert.equal(v.isExcludeValueFromExport, true, key);
    assert.equal(v.isSecret, true, key);
  }
});

test("build: 共有受け取り変数の設定", () => {
  const json = JSON.parse(build());
  const text = json.variables.find((x) => x.key === "shared_text");
  const title = json.variables.find((x) => x.key === "shared_title");
  assert.equal(text.isShareText, true);
  assert.equal(title.isShareTitle, true);
});

test("build: ショートカットの要点", () => {
  const json = JSON.parse(build());
  const s = json.categories[0].shortcuts[0];
  assert.equal(s.executionType, "app");
  assert.equal(s.method, "POST");
  assert.equal(s.url, "https://api.tumblr.com/v2/blog/{{tumblr_blog}}/post");
  assert.equal(s.bodyContent, "{{post_body}}");
  assert.equal(s.requestBodyType, "custom_text");
  assert.equal(s.contentType, "application/json");
  assert.equal(s.waitForInternet, true);
  assert.equal(s.secondaryLauncherShortcut, true);
  assert.deepEqual(s.headers, [{ key: "Authorization", value: "Bearer {{tumblr_access_token}}" }]);
  assert.deepEqual(s.responseHandling, { uiType: "toast", successOutput: "none", failureOutput: "none" });
});

test("build: コミット済み shortcuts.json はビルド結果と一致する", () => {
  const committed = fs.readFileSync(path.join(__dirname, "../shortcuts.json"), "utf8");
  assert.equal(committed, build());
});
