const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const sandbox = { URL, chrome: { runtime: { getURL: file => "chrome-extension://studash/" + file } } };
vm.runInNewContext(readFileSync(path.join(__dirname, "../site-icons.js"), "utf8"), sandbox);
const { urlFor } = sandbox.StudashSiteIcons;

test("website icons resolve to existing downloaded assets", () => {
  for (const host of ["www.google.com", "vu.um.ac.ir", "www.um.ac.ir", "chatgpt.com", "claude.ai", "gemini.google.com", "mail.google.com", "classroom.google.com", "github.com"]) {
    const file = urlFor("https://" + host + "/");
    assert.ok(file.startsWith("icons/sites/"), host);
    const location = path.join(__dirname, "..", file);
    assert.ok(existsSync(location), file);
    const png = readFileSync(location);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.ok(png.readUInt32BE(16) >= 128 && png.readUInt32BE(20) >= 128, "low-resolution logo: " + host);
  }
});

test("sites without a high-quality PNG have no image URL", () => {
  for (const host of ["example.org", "pooya.um.ac.ir", "scholar.google.com", "calendar.google.com", "drive.google.com"]) {
    assert.equal(urlFor("https://" + host + "/"), "");
  }
});

test("website matching is exact and rejects non-website URLs", () => {
  assert.equal(urlFor("https://fakechatgpt.com/"), "");
  for (const url of ["javascript:alert(1)", "file:///private/file", "not a URL", "data:image/png,test"]) {
    assert.equal(urlFor(url), "");
  }
});

test("missing or broken images show the first letter of the site name", () => {
  let onError;
  sandbox.document = { createElement: () => ({
    addEventListener: (event, callback) => { if (event === "error") onError = callback; },
  }) };
  const container = {
    hidden: false,
    child: null,
    textContent: "",
    classList: { add() {}, remove() {} },
    replaceChildren() { this.child = null; this.textContent = ""; },
    append(image) { this.child = image; },
  };
  sandbox.StudashSiteIcons.render(container, "https://example.org/", "Example");
  assert.equal(container.hidden, false);
  assert.equal(container.child, null);
  assert.equal(container.textContent, "E");
  sandbox.StudashSiteIcons.render(container, "https://chatgpt.com/", "ChatGPT");
  assert.equal(container.hidden, false);
  assert.ok(container.child.src.endsWith("chatgpt.png"));
  onError();
  assert.equal(container.hidden, false);
  assert.equal(container.child, null);
  assert.equal(container.textContent, "C");
  sandbox.StudashSiteIcons.render(container, "https://example.org/", "  پویا");
  assert.equal(container.textContent, "پ");
  sandbox.StudashSiteIcons.render(container, "https://example.org/");
  assert.equal(container.textContent, "E");
});
