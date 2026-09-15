var raw = getVariable("tumblr_pending");
if (raw) {
  var p = JSON.parse(raw);
  copyToClipboard(p.url ? p.quote + "\n" + p.url : p.quote);
}
if (response) {
  showToast("Tumblr " + response.statusCode + " " + String(response.body).slice(0, 60));
} else {
  showToast("通信エラー " + networkError);
}
