"use strict";

var TRAILING_URL = /\s*(https?:\/\/\S+)\s*$/;

function stripQuotePair(s) {
  var pairs = [['"', '"'], ["“", "”"]];
  for (var i = 0; i < pairs.length; i++) {
    var open = pairs[i][0];
    var close = pairs[i][1];
    if (s.length >= 2 && s.charAt(0) === open && s.charAt(s.length - 1) === close) {
      return s.slice(1, -1);
    }
  }
  return s;
}

function parseShared(text, subject) {
  var body = String(text || "");
  var url = "";
  var m = TRAILING_URL.exec(body);
  if (m) {
    url = m[1];
    body = body.slice(0, m.index);
  }
  var quote = stripQuotePair(body.trim()).trim();
  return {
    quote: quote,
    url: url,
    subject: String(subject || "").trim(),
  };
}

if (typeof module !== "undefined") {
  module.exports = { parseShared: parseShared };
}
