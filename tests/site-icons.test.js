const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const sandbox = { URL, chrome: { runtime: { getURL: file => "chrome-extension://studash/" + file } } };
vm.runInNewContext(readFileSync(path.join(__dirname, "../site-icons.js"), "utf8"), sandbox);
const { urlFor } = sandbox.StudashSiteIcons;

test("website icons resolve to existing downloaded assets", () => {
  for (const host of ["www.google.com", "vu.um.ac.ir", "pooya.um.ac.ir", "www.um.ac.ir", "chatgpt.com", "claude.ai", "gemini.google.com", "mail.google.com", "drive.google.com", "calendar.google.com", "meet.google.com", "classroom.google.com", "github.com"]) {
    const file = urlFor("https://" + host + "/");
    assert.ok(file.startsWith("icons/sites/"), host);
    assert.ok(existsSync(path.join(__dirname, "..", file)), file);
  }
});

test("custom website icons use Chrome's cache with the website origin only", () => {
  const icon = new URL(urlFor("https://example.org/private?token=sample"));
  assert.equal(icon.protocol, "chrome-extension:");
  assert.equal(icon.pathname, "/_favicon/");
  assert.equal(icon.searchParams.get("pageUrl"), "https://example.org/");
  assert.equal(icon.searchParams.get("size"), "64");
});

test("website matching is exact and rejects non-website URLs", () => {
  assert.ok(urlFor("https://fakechatgpt.com/").startsWith("chrome-extension:"));
  for (const url of ["javascript:alert(1)", "file:///private/file", "not a URL", "data:image/png,test"]) {
    assert.equal(urlFor(url), "");
  }
});
