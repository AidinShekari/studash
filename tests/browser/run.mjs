// Runs tests/browser/*.html in headless Chrome and prints the results.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const chrome = process.env.CHROME_PATH || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!chrome) { console.error("Chrome not found; set CHROME_PATH"); process.exit(2); }
const page = pathToFileURL(resolve(process.argv[2] || "tests/browser/ui-kit.html")).href;
const viewportWidth = Number(process.argv[3] || 1440);
const testUrl = new URL(page);
testUrl.searchParams.set('width', viewportWidth);
testUrl.searchParams.set('mode', process.argv[4] || 'dark');
const profile = mkdtempSync(join(tmpdir(), "sd-test-"));
let html;
try {
  html = execFileSync(chrome, ["--headless=new", `--window-size=${viewportWidth},1000`, "--disable-gpu", "--allow-file-access-from-files", `--user-data-dir=${profile}`, "--virtual-time-budget=5000", "--dump-dom", testUrl.href], { encoding: "utf8" });
} finally {
  rmSync(profile, { recursive: true, force: true });
}
const m = html.match(/<pre id="results">([\s\S]*?)<\/pre>/);
if (!m || !m[1]) { console.error("No results — page failed to run"); process.exit(1); }
const results = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? "✔" : "✖"} ${r.name}${r.ok ? "" : " — " + r.error}`);
  if (!r.ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
