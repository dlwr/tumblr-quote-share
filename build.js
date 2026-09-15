"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function build() {
  const base = JSON.parse(read("template/shortcuts.json"));
  const shortcut = base.categories[0].shortcuts[0];
  shortcut.codeOnPrepare = read("src/lib.js") + "\n" + read("src/before.js");
  shortcut.codeOnSuccess = read("src/success.js");
  shortcut.codeOnFailure = read("src/failure.js");
  return JSON.stringify(base, null, 2) + "\n";
}

if (require.main === module) {
  fs.writeFileSync(path.join(ROOT, "shortcuts.json"), build());
}

module.exports = { build };
