"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const lib = require("../src/lib.js");

test("lib は関数をエクスポートする", () => {
  assert.equal(typeof lib, "object");
});
