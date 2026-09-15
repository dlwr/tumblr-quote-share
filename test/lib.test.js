"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseShared, escapeHtml, stripFragment, hostOf, extractTitle, buildSource, tokenIsExpired, tokenUpdateFromResponse, buildQuoteBody, usableSubject } = require("../src/lib.js");

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

test("escapeHtml: 5 文字をエスケープする", () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
});

test("stripFragment: # 以降を落とす", () => {
  assert.equal(stripFragment("https://example.com/a?b=1#:~:text=x"), "https://example.com/a?b=1");
  assert.equal(stripFragment("https://example.com/a"), "https://example.com/a");
});

test("hostOf: ホスト名だけを返す", () => {
  assert.equal(hostOf("https://www.example.com:8080/x?y#z"), "www.example.com");
  assert.equal(hostOf("not a url"), "");
});

test("extractTitle: title を取り出しエンティティを戻し空白を畳む", () => {
  const html = "<html><head>\n<title>\n  A &amp; B &#x2013; C&#8217;s\n  D\n</title></head><body><title>ignored</title></body></html>";
  assert.equal(extractTitle(html), "A & B – C’s D");
});

test("extractTitle: 属性付き title タグと大文字にも対応", () => {
  assert.equal(extractTitle('<TITLE data-x="1">Hello</TITLE>'), "Hello");
});

test("extractTitle: title が無ければ空文字", () => {
  assert.equal(extractTitle("<html></html>"), "");
});

test("buildSource: タイトルをリンクにする", () => {
  assert.equal(
    buildSource("https://sizu.me/p/1#:~:text=a", "08月10日（月）｜静かな生活"),
    '<a href="https://sizu.me/p/1#:~:text=a">08月10日（月）｜静かな生活</a>'
  );
});

test("buildSource: タイトルが無ければホスト名", () => {
  assert.equal(buildSource("https://sizu.me/p/1", ""), '<a href="https://sizu.me/p/1">sizu.me</a>');
});

test("buildSource: タイトルと URL をエスケープする", () => {
  assert.equal(
    buildSource('https://e.com/?a=1&b="2"', "<b> & co"),
    '<a href="https://e.com/?a=1&amp;b=&quot;2&quot;">&lt;b&gt; &amp; co</a>'
  );
});

test("buildSource: URL が無ければ空文字", () => {
  assert.equal(buildSource("", "title"), "");
});

test("tokenIsExpired: 空なら期限切れ扱い", () => {
  assert.equal(tokenIsExpired("", 1000), true);
  assert.equal(tokenIsExpired("abc", 1000), true);
});

test("tokenIsExpired: 期限 60 秒前から切れ扱い", () => {
  assert.equal(tokenIsExpired("1000000", 1000000 - 60001), false);
  assert.equal(tokenIsExpired("1000000", 1000000 - 60000), true);
  assert.equal(tokenIsExpired("1000000", 1000000), true);
});

test("tokenUpdateFromResponse: 新しいトークンと期限を返す", () => {
  const r = tokenUpdateFromResponse({ access_token: "A", refresh_token: "R", expires_in: 2520 }, 1000, "OLD");
  assert.deepEqual(r, { accessToken: "A", refreshToken: "R", expiresAt: String(1000 + 2520 * 1000) });
});

test("tokenUpdateFromResponse: refresh_token が無ければ現状維持", () => {
  const r = tokenUpdateFromResponse({ access_token: "A", expires_in: 10 }, 0, "OLD");
  assert.equal(r.refreshToken, "OLD");
});

test("buildQuoteBody: quote はエスケープし source は生の HTML", () => {
  assert.deepEqual(buildQuoteBody("a <b> & c", '<a href="u">t</a>', "draft"), {
    type: "quote",
    quote: "a &lt;b&gt; &amp; c",
    source: '<a href="u">t</a>',
    state: "draft",
  });
});

test("buildQuoteBody: source が空ならキーを含めない", () => {
  assert.deepEqual(buildQuoteBody("a", "", "published"), { type: "quote", quote: "a", state: "published" });
});

test("extractTitle: 範囲外の数値文字参照はそのまま残し例外を投げない", () => {
  assert.equal(extractTitle("<title>A &#99999999; B &#x110000; C</title>"), "A &#99999999; B &#x110000; C");
});

test("buildSource: http(s) 以外の URL はリンクにしない", () => {
  assert.equal(buildSource("javascript:alert(1)", "t"), "");
  assert.equal(buildSource("ftp://example.com/a", "t"), "");
});

test("usableSubject: URL を含む subject は捨てる", () => {
  assert.equal(usableSubject("リンク: https://ishicoro.substack.com/ を含む"), "");
  assert.equal(usableSubject("http://example.com"), "");
});

test("usableSubject: 普通のタイトルはそのまま", () => {
  assert.equal(usableSubject("08月10日（月）｜静かな生活"), "08月10日（月）｜静かな生活");
  assert.equal(usableSubject(""), "");
});
