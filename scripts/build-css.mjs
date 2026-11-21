import { readFileSync, watch, writeFileSync } from "node:fs";
import { basename } from "node:path";

const styles = ["styles/src/v1.3-base.css", "styles/src/context-menu.css", "styles/src/v1.3-fixes.css"];
function build() {
  writeFileSync("styles/studash.css", styles.map(file => readFileSync(file, "utf8")).join("\n"));
}
build();

if (process.argv.includes("--watch")) {
  const inputs = new Set(styles.map(file => basename(file)));
  watch("styles/src", (event, file) => {
    if (inputs.has(String(file))) build();
  });
}
