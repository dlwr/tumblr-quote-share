# tumblr-quote-share

Android の共有シートから、選択したテキストを Tumblr の quote 投稿にする。HTTP Shortcuts のショートカット定義と、そこに埋め込むスクリプト。

Chrome で文章を選択 → 共有 → 「Tumblr Quote」で、画面を開かずに投稿が完了する。出典はページタイトルをリンクにしたものが付く（Chrome が渡す text fragment 付き URL なので、リンクを踏むと引用箇所がハイライトされる）。

## 必要なもの

- Android 11 以降と [HTTP Shortcuts](https://http-shortcuts.rmy.ch/)
- Tumblr のアプリ登録（OAuth consumer key / secret）
- 初回のトークン交換のために curl と python3 が動く PC

## セットアップ

1. https://www.tumblr.com/oauth/apps でアプリを登録する。callback URL / OAuth2 redirect URL は自分が管理する任意の URL でよい（受け口は不要。リダイレクト先のアドレスバーから `code` を読むだけ）。
2. PC で `scripts/auth.sh` を実行し、表示された認可 URL をブラウザで開いて許可し、リダイレクト先 URL の `code` を貼る。`tumblr_access_token` / `tumblr_refresh_token` / `tumblr_token_expires_at` の値が表示される。
3. HTTP Shortcuts の Import / Export → Import from URL に次を貼る。
   `https://raw.githubusercontent.com/dlwr/tumblr-quote-share/main/shortcuts.json`
4. Global Variables で次を埋める。
   - `tumblr_blog`: 投稿先ブログ名
   - `tumblr_client_id` / `tumblr_client_secret`: 手順 1 の値
   - `tumblr_access_token` / `tumblr_refresh_token` / `tumblr_token_expires_at`: 手順 2 の値
   - `tumblr_post_state`: 最初は `draft` のまま1件試し、問題なければ `published` にする
5. 共有シートで「Tumblr Quote」をピン留めする。

トークンの更新はショートカットが自動で行う。リフレッシュトークンが失効した場合（Toast に「トークン更新失敗 401」）は手順 2 をやり直す。

## 挙動

- 本文と URL は共有テキストの末尾 URL で切り分ける。URL が無い共有元（Kindle 等）からでも出典なしで投稿する。
- 出典の表示名は、共有の subject → ページの `<title>` → ホスト名 の順。
- 失敗時は Toast にステータスとレスポンス先頭を出し、本文と URL をクリップボードに退避する。圏外のときはネットワーク復帰後に自動で投稿する。

## 開発

```
npm test        # node --test
npm run build   # src/*.js を template/shortcuts.json に埋め込んで shortcuts.json を生成
```

`src/lib.js` が純粋関数、`src/before.js` が実行前スクリプト（`lib.js` と連結して埋め込まれる）、`src/success.js` / `src/failure.js` が成功・失敗時のスクリプト。`shortcuts.json` はコミットする生成物で、テストがビルド結果との一致を検査する。
