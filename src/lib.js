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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripFragment(url) {
  var i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

function hostOf(url) {
  var m = /^https?:\/\/([^\/?#:]+)/i.exec(url);
  return m ? m[1] : "";
}

var NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, function (all, code) {
    var lower = code.toLowerCase();
    if (lower.charAt(0) === "#") {
      var n = lower.charAt(1) === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      return isNaN(n) ? all : String.fromCodePoint(n);
    }
    return NAMED_ENTITIES.hasOwnProperty(lower) ? NAMED_ENTITIES[lower] : all;
  });
}

function extractTitle(html) {
  var m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ""));
  if (!m) return "";
  return decodeEntities(m[1]).replace(/\s+/g, " ").trim();
}

function buildSource(url, title) {
  if (!url) return "";
  var label = title || hostOf(url);
  return '<a href="' + escapeHtml(url) + '">' + escapeHtml(label) + "</a>";
}

if (typeof module !== "undefined") {
  module.exports = {
    parseShared: parseShared,
    escapeHtml: escapeHtml,
    stripFragment: stripFragment,
    hostOf: hostOf,
    extractTitle: extractTitle,
    buildSource: buildSource,
  };
}
