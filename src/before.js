var TOKEN_URL = "https://api.tumblr.com/v2/oauth2/token";

function pendingText(p) {
  return p.url ? p.quote + "\n" + p.url : p.quote;
}

function failAndAbort(message, pending) {
  if (pending) copyToClipboard(pendingText(pending));
  showToast(message);
  abort();
}

function loadPending() {
  var sharedText = getVariable("shared_text");
  if (sharedText.trim() !== "") {
    var parsed = parseShared(sharedText, getVariable("shared_title"));
    setVariable("tumblr_pending", JSON.stringify(parsed));
    return parsed;
  }
  var raw = getVariable("tumblr_pending");
  return raw ? JSON.parse(raw) : null;
}

function refreshTokenIfNeeded(pending) {
  if (!tokenIsExpired(getVariable("tumblr_token_expires_at"), Date.now())) return;
  var result = sendHttpRequest(TOKEN_URL, {
    method: "POST",
    formData: {
      grant_type: "refresh_token",
      refresh_token: getVariable("tumblr_refresh_token"),
      client_id: getVariable("tumblr_client_id"),
      client_secret: getVariable("tumblr_client_secret"),
    },
  });
  if (result.status === "success") {
    var t = tokenUpdateFromResponse(JSON.parse(result.response.body), Date.now(), getVariable("tumblr_refresh_token"));
    setVariable("tumblr_access_token", t.accessToken);
    setVariable("tumblr_refresh_token", t.refreshToken);
    setVariable("tumblr_token_expires_at", t.expiresAt);
    return;
  }
  if (result.status === "httpError") {
    failAndAbort("トークン更新失敗 " + result.response.statusCode + " " + String(result.response.body).slice(0, 60), pending);
  }
}

function resolveTitle(pending) {
  var subject = usableSubject(pending.subject);
  if (subject) return subject;
  if (!pending.url) return "";
  var result = sendHttpRequest(stripFragment(pending.url), { method: "GET" });
  return result.status === "success" ? extractTitle(result.response.body) : "";
}

var pending = loadPending();
if (!pending || !pending.quote) {
  failAndAbort("引用する本文がありません", null);
}
refreshTokenIfNeeded(pending);
var source = buildSource(pending.url, resolveTitle(pending));
setVariable("post_body", JSON.stringify(buildQuoteBody(pending.quote, source, getVariable("tumblr_post_state"))));
