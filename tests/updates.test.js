const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = readFileSync(path.join(__dirname, "../repository-updates.js"), "utf8");
function fixture(fetch) {
  const stored = {};
  const sandbox = {
    chrome: { storage: { local: {
      get: async key => ({ [key]: stored[key] }),
      set: async value => Object.assign(stored, value),
    } } },
    fetch, AbortSignal, Date, JSON, Set,
  };
  vm.runInNewContext(source, sandbox);
  return { client: sandbox.StudashUpdates, stored };
}
const entry = { id: "one", date: "2026-11-21", title: "Update", body: "<script>text only</script>" };

test("announcement feed validates fields, sorts dates and removes duplicates", () => {
  const { client } = fixture();
  const items = client.normalize({ announcements: [
    { ...entry, id: "old", date: "2026-11-01" }, entry, entry,
    { ...entry, id: "bad", date: "invalid" }, { ...entry, id: "empty", title: "" },
  ] });
  assert.deepEqual(Array.from(items, item => item.id), ["one", "old"]);
  assert.equal(items[0].body, entry.body);
  assert.throws(() => client.normalize({ html: "invalid" }));
});

test("concurrent requests share one public fetch and cached loads avoid a second fetch", async () => {
  let requests = 0;
  const { client } = fixture(async (url, options) => {
    requests++;
    assert.equal(url, "https://raw.githubusercontent.com/AidinShekari/studash/main/data/announcements.json");
    assert.equal(options.credentials, "omit");
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ announcements: [entry] }));
  });
  const first = client.get();
  const second = client.get(true);
  assert.equal(first, second);
  assert.equal((await first).items.length, 1);
  assert.equal((await client.get()).stale, false);
  assert.equal(requests, 1);
  await client.get(true);
  assert.equal(requests, 2);
});

test("network and invalid JSON failures retain the previous announcements", async () => {
  let response = "good";
  const { client, stored } = fixture(async () => {
    if (response === "network") throw new Error("offline");
    return new Response(response === "good" ? JSON.stringify({ announcements: [entry] }) : "invalid");
  });
  const initial = await client.get();
  response = "network";
  const offline = await client.get(true);
  assert.equal(offline.stale, true);
  assert.equal(offline.items[0].id, "one");
  assert.equal(offline.checkedAt, initial.checkedAt);
  response = "invalid";
  assert.equal((await client.get(true)).items[0].id, "one");
  assert.equal(stored.studashAnnouncements.items[0].id, "one");
});

test("an empty published feed clears old announcements", async () => {
  const { client } = fixture(async () => Response.json({ announcements: [] }));
  const result = await client.get();
  assert.equal(result.items.length, 0);
  assert.equal(result.stale, false);
});
