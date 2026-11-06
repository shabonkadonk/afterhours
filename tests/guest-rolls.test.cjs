const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const { File: BufferFile } = require("node:buffer");

global.File ??= BufferFile;

const root = path.resolve(__dirname, "..");
const modules = new Map();
const overrides = new Map();
let activeUser = null;
let activeAdmin = null;
let rpcResponse = { data: { roll_id: "11111111-1111-4111-8111-111111111111" }, error: null };
let browserClientOptions = null;
let browserClientCalls = 0;

class TestNextResponse extends Response {
  static json(value, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    return new TestNextResponse(JSON.stringify(value), { ...init, headers });
  }
}

overrides.set("next/server", { NextResponse: TestNextResponse });
overrides.set("@/lib/supabase/server", {
  getSupabaseServerClient: async () => activeUser ? { auth: { getUser: async () => ({ data: { user: activeUser }, error: null }) } } : { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
});
overrides.set("@/lib/supabase/admin", { getSupabaseAdminClient: () => activeAdmin });
overrides.set("@supabase/ssr", {
  createBrowserClient: (_url, _key, options) => {
    browserClientCalls += 1;
    browserClientOptions = options;
    return { client: browserClientCalls };
  },
});

function loadTypeScript(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (modules.has(absolutePath)) return modules.get(absolutePath).exports;
  const module = { exports: {} };
  modules.set(absolutePath, module);
  const source = fs.readFileSync(absolutePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (specifier) => {
    if (overrides.has(specifier)) return overrides.get(specifier);
    if (specifier.startsWith("@/")) return loadTypeScript(`${specifier.slice(2)}.ts`);
    if (specifier.startsWith("./")) return loadTypeScript(path.join(path.dirname(relativePath), `${specifier.slice(2)}.ts`));
    return require(specifier);
  };
  new Function("require", "module", "exports", output)(localRequire, module, module.exports);
  return module.exports;
}

const joinRoute = loadTypeScript("app/api/join/route.ts");
const expireRoute = loadTypeScript("app/api/cron/expire-rolls/route.ts");
const { createPhotoZip, preparePhotoFiles, safeFilePart, supportsFileShare } = loadTypeScript("lib/photo-export.ts");
const { ensureGuestSession } = loadTypeScript("lib/supabase/guest.ts");

function joinRequest(body, origin = "https://afterhours.test") {
  return new Request("https://afterhours.test/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: "afterhours.test", Origin: origin, "x-real-ip": "203.0.113.8" },
    body: JSON.stringify(body),
  });
}

test("anonymous guest sign-in persists through the browser client and reuses an existing session", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "publishable-key";
  const { getSupabaseBrowserClient } = loadTypeScript("lib/supabase/client.ts");
  const firstClient = getSupabaseBrowserClient();
  assert.strictEqual(getSupabaseBrowserClient(), firstClient, "a single browser client keeps the same persisted session store");
  assert.equal(browserClientOptions.auth.persistSession, true);
  assert.equal(browserClientCalls, 1);

  let signInCalls = 0;
  const guest = { id: "22222222-2222-4222-8222-222222222222", is_anonymous: true };
  const supabase = { auth: { signInAnonymously: async () => { signInCalls += 1; return { data: { user: guest }, error: null }; } } };
  assert.strictEqual(await ensureGuestSession(supabase, null), guest);
  const existingUser = { id: "33333333-3333-4333-8333-333333333333", is_anonymous: false };
  assert.strictEqual(await ensureGuestSession(supabase, existingUser), existingUser);
  assert.equal(signInCalls, 1, "returning sessions do not create a new anonymous user");
});

test("join route rejects cross-origin requests and users without a guest session", async () => {
  const response = await joinRoute.POST(joinRequest({ code: "AFTR-A1B2C3", displayName: "Rae" }, "https://attacker.test"));
  assert.equal(response.status, 403);

  activeUser = null;
  activeAdmin = { rpc: async () => { throw new Error("Should not call the admin database."); } };
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const unauthenticated = await joinRoute.POST(joinRequest({ code: "AFTR-A1B2C3", displayName: "Rae" }));
  assert.equal(unauthenticated.status, 401);
});

test("join route validates code input and HMACs the client address before calling its service-only RPC", async () => {
  activeUser = { id: "22222222-2222-4222-8222-222222222222", is_anonymous: true };
  const calls = [];
  activeAdmin = { rpc: async (name, args) => { calls.push({ name, args }); return rpcResponse; } };
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

  const invalid = await joinRoute.POST(joinRequest({ code: "guess", displayName: "Rae" }));
  assert.equal(invalid.status, 400);
  assert.equal(calls.length, 0);

  rpcResponse = { data: { roll_id: "11111111-1111-4111-8111-111111111111" }, error: null };
  const response = await joinRoute.POST(joinRequest({ code: "aftr-a1b2c3d4", displayName: "  Rae  " }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { rollId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(calls[0].name, "join_roll_by_invitation");
  assert.equal(calls[0].args.target_user_id, activeUser.id);
  assert.equal(calls[0].args.target_join_code, "AFTR-A1B2C3D4");
  assert.equal(calls[0].args.target_display_name, "Rae");
  assert.equal(calls[0].args.target_rate_key, crypto.createHmac("sha256", "test-service-role-key").update("203.0.113.8").digest("hex"));

  const legacyCode = await joinRoute.POST(joinRequest({ code: "a1b2c3d4e5", displayName: "Rae" }));
  assert.equal(legacyCode.status, 200, "existing ten-character invite codes remain valid after migration");
  assert.equal(calls[1].args.target_join_code, "A1B2C3D4E5");

  const token = "ab".repeat(32);
  const tokenJoin = await joinRoute.POST(joinRequest({ token, displayName: "Rae" }));
  assert.equal(tokenJoin.status, 200);
  assert.equal(calls[2].args.target_invite_token, token);
  assert.equal(calls[2].args.target_join_code, null);
});

test("join route turns the database invitation rate limit into HTTP 429", async () => {
  activeUser = { id: "22222222-2222-4222-8222-222222222222", is_anonymous: true };
  activeAdmin = { rpc: async () => ({ data: { error: "rate_limited" }, error: null }) };
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  const response = await joinRoute.POST(joinRequest({ code: "AFTR-A1B2C3D4", displayName: "Rae" }));
  assert.equal(response.status, 429);
});

test("expiration cron requires its secret and removes Storage files before deleting roll records", async () => {
  process.env.CRON_SECRET = "test-cron-secret";
  const events = [];
  activeAdmin = {
    rpc: async (name) => {
      events.push(name);
      if (name === "claim_expired_rolls") return { data: [{ roll_id: "11111111-1111-4111-8111-111111111111", lease_token: "lease", object_paths: ["u/r/photo.jpg"] }], error: null };
      if (name === "finalize_expired_roll") return { data: true, error: null };
      return { data: 0, error: null };
    },
    storage: { from: () => ({ remove: async (paths) => { events.push(["remove", paths]); return { error: null }; } }) },
  };
  const unauthorized = await expireRoute.GET(new Request("https://afterhours.test/api/cron/expire-rolls", { headers: { Authorization: "Bearer wrong" } }));
  assert.equal(unauthorized.status, 401);
  assert.equal(events.length, 0);

  const response = await expireRoute.GET(new Request("https://afterhours.test/api/cron/expire-rolls", { headers: { Authorization: "Bearer test-cron-secret" } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { claimed: 1, deleted: 1, retrying: 0, anonymousUsersRemoved: 0 });
  assert.equal(events[0], "claim_expired_rolls");
  assert.equal(events[1][0], "remove");
  assert.equal(events[2], "finalize_expired_roll");
});

test("photo export uses safe unique names, reports failed downloads, and creates a readable stored ZIP", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async (url) => url === "bad" ? new Response("bad", { status: 404 }) : new Response("hello", { headers: { "Content-Type": "image/jpeg" } });

  assert.equal(safeFilePart("../A Friend: Night"), "A-Friend-Night");
  const timestamp = "2026-11-05T20:30:00.000Z";
  const input = [
    { id: "one", src: "one", by: "A/Friend", at: timestamp, caption: "first" },
    { id: "two", src: "two", by: "AFriend", at: timestamp, caption: "second" },
    { id: "bad", src: "bad", by: "Someone", at: timestamp, caption: "unavailable" },
  ];
  const progress = [];
  const { files, failed } = await preparePhotoFiles(input, "../Friday Night", new AbortController().signal, (done) => progress.push(done));
  assert.equal(files.length, 2);
  assert.equal(failed.length, 1);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.notEqual(files[0].filename.toLowerCase(), files[1].filename.toLowerCase());

  const zip = await createPhotoZip(files, true);
  assert.equal(zip.type, "application/zip");
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const names = [];
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const size = view.getUint32(offset + 22, true);
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    names.push(name);
    assert.equal(view.getUint16(offset + 12, true), 33, "ZIP entries use the valid DOS epoch date");
    if (names.length === 1) {
      assert.equal(view.getUint32(offset + 14, true), 0x3610a686, "CRC32 matches the stored photo bytes");
      assert.equal(decoder.decode(bytes.slice(offset + 30 + nameLength + extraLength, offset + 30 + nameLength + extraLength + size)), "hello");
    }
    offset += 30 + nameLength + extraLength + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50, "central directory follows the local file entries");
  assert.ok(names[0].startsWith("AFriend/"));
  assert.ok(names.includes("photos.csv"));
});

test("photo export honors cancellation", async () => {
  const aborter = new AbortController();
  aborter.abort();
  await assert.rejects(
    () => preparePhotoFiles([{ id: "one", src: "one", by: "Rae", at: "2026-11-05T20:30:00Z", caption: "" }], "Roll", aborter.signal, () => {}),
    (error) => error.name === "AbortError",
  );
});

test("file-share detection selects the ZIP fallback when the browser cannot share files", () => {
  const files = [new File(["photo"], "photo.jpg", { type: "image/jpeg" })];
  assert.equal(supportsFileShare({}, files), false);
  assert.equal(supportsFileShare({ share: async () => {}, canShare: () => false }, files), false);
  assert.equal(supportsFileShare({ share: async () => {}, canShare: () => { throw new TypeError("Unsupported files"); } }, files), false);
  assert.equal(supportsFileShare({ share: async () => {}, canShare: ({ files: shared }) => shared?.length === 1 }, files), true);
});

test("migration contract keeps joins rate limited and roll/photo lifecycle server controlled", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261106000000_host_guest_expiration.sql"), "utf8");
  const initial = fs.readFileSync(path.join(root, "supabase/migrations/20261028000000_initial_backend.sql"), "utf8");
  assert.match(migration, /attempt_count >= 10/);
  assert.match(migration, /interval '15 minutes'/);
  assert.match(migration, /grant execute on function public\.join_roll_by_invitation\(uuid, text, text, text, text\) to service_role/i);
  assert.match(initial, /photo_count < r\.photo_limit/);
  assert.match(migration, /for update\s+skip locked/i);
  assert.match(migration, /expires_at <= now\(\) - interval '7 days'/);
  assert.match(migration, /grant execute on function public\.renew_roll\(uuid\) to authenticated/i);
  assert.match(migration, /grant select \(id, owner_id, name, theme, status, created_at, ends_at, photo_limit/i);
  assert.match(migration, /allowed_mime_types = array\['image\/jpeg'\]/);
  assert.match(migration, /gen_random_bytes\(4\)/);
  assert.match(migration, /select invite_code into code_value/);
  assert.match(migration, /grant insert \(owner_id, name, theme, ends_at, photo_limit\) on public\.rolls to authenticated/i);
});
