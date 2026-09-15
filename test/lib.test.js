"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseShared } = require("../src/lib.js");

test("parseShared: Chrome 形式（引用符付き本文 + 改行 + text fragment URL）", () => {
  const text = '"あれま、挨拶もないのかい？"\n\nhttps://sizu.me/suyhnc/posts/kccfz2ur0nt6#:~:text=%E3%81%82%E3%82%8C%E3%81%BE';
  assert.deepEqual(parseShared(text, ""), {
    quote: "あれま、挨拶もないのかい？",
    url: "https://sizu.me/suyhnc/posts/kccfz2ur0nt6#:~:text=%E3%81%82%E3%82%8C%E3%81%BE",
    subject: "",
  });
});

test("parseShared: 全角引用符も1組だけ剥がす", () => {
  assert.equal(parseShared("“本文”\nhttps://example.com/a", "").quote, "本文");
});

test("parseShared: 鉤括弧は剥がさない", () => {
  assert.equal(parseShared("「本文」\nhttps://example.com/a", "").quote, "「本文」");
});

test("parseShared: URL が無ければ url は空文字", () => {
  assert.deepEqual(parseShared("本文だけ", ""), { quote: "本文だけ", url: "", subject: "" });
});

test("parseShared: URL だけなら quote は空文字", () => {
  assert.deepEqual(parseShared("https://example.com/a", ""), { quote: "", url: "https://example.com/a", subject: "" });
});

test("parseShared: 本文中の URL は末尾でなければ本文の一部", () => {
  const r = parseShared("参考 https://example.com/x を見た\nhttps://example.com/src", "");
  assert.equal(r.quote, "参考 https://example.com/x を見た");
  assert.equal(r.url, "https://example.com/src");
});

test("parseShared: subject は trim され、null は空文字", () => {
  assert.equal(parseShared("a\nhttps://example.com/", "  タイトル ").subject, "タイトル");
  assert.equal(parseShared("a\nhttps://example.com/", null).subject, "");
});

test("parseShared: 複数行の本文は改行を保つ", () => {
  const r = parseShared('"1行目\n2行目"\nhttps://example.com/', "");
  assert.equal(r.quote, "1行目\n2行目");
});
