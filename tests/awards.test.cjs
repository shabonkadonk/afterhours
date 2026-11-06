const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const modules = new Map();
const requireOverrides = new Map();
let activeSupabase;

class TestNextResponse extends Response {
  static json(value, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    return new TestNextResponse(JSON.stringify(value), { ...init, headers });
  }
}

requireOverrides.set("next/server", { NextResponse: TestNextResponse });
requireOverrides.set("@/lib/supabase/server", { getSupabaseServerClient: async () => activeSupabase });

function loadTypeScript(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (modules.has(absolutePath)) return modules.get(absolutePath).exports;
  const module = { exports: {} };
  modules.set(absolutePath, module);
  const source = fs.readFileSync(absolutePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (specifier) => {
    if (requireOverrides.has(specifier)) return requireOverrides.get(specifier);
    if (specifier.startsWith("@/")) return loadTypeScript(`${specifier.slice(2)}.ts`);
    if (specifier.startsWith("./")) return loadTypeScript(path.join(path.dirname(relativePath), `${specifier.slice(2)}.ts`));
    return require(specifier);
  };
  new Function("require", "module", "exports", output)(localRequire, module, module.exports);
  return module.exports;
}

const { AWARD_CATEGORIES, AwardsProviderError } = loadTypeScript("lib/ai/awards-types.ts");
const { buildAwardsResult, parseAwardCandidate, validateAwardsResult } = loadTypeScript("lib/ai/awards-validation.ts");
const { CloudflareAwardsProvider } = loadTypeScript("lib/ai/cloudflare-provider.ts");
const awardsRoute = loadTypeScript("app/api/rolls/[id]/awards/route.ts");

const photoIds = Array.from({ length: 10 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const rollId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function fakeSupabase({ user, roll, awards = null, photos = [], rpcHandlers = {} }) {
  const calls = [];
  const queryResult = (table) => ({ data: typeof table === "function" ? table() : table, error: null });
  return {
    calls,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      let query;
      const tableValue = table === "rolls" ? roll : table === "roll_awards" ? awards : table === "photos" ? photos : null;
      query = {
        select() { return query; },
        eq() { return query; },
        in() { return query; },
        maybeSingle: async () => queryResult(tableValue),
        then(resolve, reject) { return Promise.resolve(queryResult(tableValue)).then(resolve, reject); },
      };
      return query;
    },
    rpc(name, args) {
      calls.push({ name, args });
      const handler = rpcHandlers[name];
      return Promise.resolve(handler ? handler(args) : { data: null, error: { message: "Unexpected RPC" } });
    },
    storage: { from() { throw new Error("Mock tests must not read photo storage."); } },
  };
}

function revealedRoll() {
  return { id: rollId, status: "revealed", owner_id: userId };
}

function postRequest(payload) {
  return new Request(`http://localhost/api/rolls/${rollId}/awards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function routeContext() {
  return { params: Promise.resolve({ id: rollId }) };
}

test("mock candidates produce no more than eight grounded, unique awards with a final Photo of the Night", () => {
  const candidates = photoIds.map((photoId, index) => ({
    photoId,
    awardTitle: AWARD_CATEGORIES[index],
    explanation: `Sample visual citation ${index + 1}.`,
    visualNote: `Sample visual detail ${index + 1}.`,
    score: 5 - (index % 3),
  }));
  const result = buildAwardsResult(candidates, photoIds);

  assert.ok(result.awards.length >= 5 && result.awards.length <= 8);
  assert.equal(result.awards.at(-1).title, "Photo of the Night");
  assert.equal(new Set(result.awards.map((award) => award.title)).size, result.awards.length);
  for (const award of result.awards) {
    assert.ok(photoIds.includes(award.photoId));
    assert.ok(award.explanation.length <= 220);
  }
});

test("award validation rejects fabricated photo IDs and duplicate categories", () => {
  assert.throws(() => validateAwardsResult({ awards: [
    { title: "Funniest Photo", photoId: "not-selected", explanation: "A short note." },
    { title: "Photo of the Night", photoId: photoIds[0], explanation: "A short note." },
  ] }, photoIds));

  assert.throws(() => validateAwardsResult({ awards: [
    { title: "Funniest Photo", photoId: photoIds[0], explanation: "A short note." },
    { title: "Funniest Photo", photoId: photoIds[1], explanation: "Another short note." },
    { title: "Photo of the Night", photoId: photoIds[2], explanation: "The final note." },
  ] }, photoIds));
});

test("candidate validation drops personal appearance, relationship, and intoxication claims", () => {
  assert.equal(parseAwardCandidate({
    visualNote: "This person looks drunk.",
    score: 4,
    awardTitle: "Funniest Photo",
    explanation: "A funny moment.",
  }, photoIds[0]), null);
});

test("Cloudflare adapter uses the documented prompt plus single-image REST input", async () => {
  const originalFetch = global.fetch;
  const previous = {
    account: process.env.CLOUDFLARE_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
    model: process.env.CLOUDFLARE_MODEL_ID,
  };
  let requestUrl;
  let requestBody;
  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account-test";
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    process.env.CLOUDFLARE_MODEL_ID = "@cf/meta/llama-3.2-11b-vision-instruct";
    global.fetch = async (url, options) => {
      requestUrl = String(url);
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ success: true, result: { response: "Award Title: Funniest Photo\nVisual Note: A bright flash catches the group mid-laugh.\nScore: 4\nExplanation: The flash freezes a lively moment." } }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const provider = new CloudflareAwardsProvider();
    const candidate = await provider.analyzePhoto({ id: photoIds[0], imageDataUrl: "data:image/jpeg;base64,YWJj" });

    assert.match(requestUrl, /\/ai\/run\/@cf\/meta\/llama-3\.2-11b-vision-instruct$/);
    assert.deepEqual(Object.keys(requestBody), ["prompt", "image", "max_tokens", "temperature"]);
    assert.equal(requestBody.image, "data:image/jpeg;base64,YWJj");
    assert.match(requestBody.prompt, /Return exactly four labeled lines/);
    assert.equal(candidate.photoId, photoIds[0]);
    assert.equal(candidate.awardTitle, "Funniest Photo");
  } finally {
    global.fetch = originalFetch;
    if (previous.account === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = previous.account;
    if (previous.token === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = previous.token;
    if (previous.model === undefined) delete process.env.CLOUDFLARE_MODEL_ID; else process.env.CLOUDFLARE_MODEL_ID = previous.model;
  }
});

test("Cloudflare adapter rejects invalid model output without exposing its contents", async () => {
  const originalFetch = global.fetch;
  const previous = { account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN };
  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account-test";
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    global.fetch = async () => new Response(JSON.stringify({ success: true, result: { response: "not json" } }), { status: 200 });
    const provider = new CloudflareAwardsProvider();
    await assert.rejects(
      provider.analyzePhoto({ id: photoIds[0], imageDataUrl: "data:image/jpeg;base64,YWJj" }),
      (error) => error instanceof AwardsProviderError && error.code === "invalid_response" && !error.message.includes("not json"),
    );
  } finally {
    global.fetch = originalFetch;
    if (previous.account === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = previous.account;
    if (previous.token === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = previous.token;
  }
});

test("Cloudflare adapter accepts a safe plain-text visual note when the model omits the requested labels", async () => {
  const originalFetch = global.fetch;
  const previous = { account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN };
  try {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account-test";
    process.env.CLOUDFLARE_API_TOKEN = "test-token";
    global.fetch = async () => new Response(JSON.stringify({
      success: true,
      result: { response: "Warm lights frame the group as everyone leans toward the camera." },
    }), { status: 200 });
    const provider = new CloudflareAwardsProvider();
    const candidate = await provider.analyzePhoto({ id: photoIds[0], imageDataUrl: "data:image/jpeg;base64,YWJj" });
    assert.equal(candidate.visualNote, "Warm lights frame the group as everyone leans toward the camera.");
    assert.equal(candidate.awardTitle, null);
  } finally {
    global.fetch = originalFetch;
    if (previous.account === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = previous.account;
    if (previous.token === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = previous.token;
  }
});

test("Awards API hides rolls the authenticated member cannot access", async () => {
  activeSupabase = fakeSupabase({ user: { id: userId }, roll: null });
  const response = await awardsRoute.POST(postRequest({ photoIds: [photoIds[0]], consent: true }), routeContext());
  assert.equal(response.status, 404);
  assert.equal(activeSupabase.calls.length, 0);
});

test("Awards API returns cached saved ceremonies to roll viewers", async () => {
  const saved = {
    generation_status: "completed",
    awards_json: { awards: [{ title: "Photo of the Night", photoId: photoIds[0], explanation: "A saved citation." }], summary: "Saved." },
    provider: "mock",
    model: "sample-awards-v1",
    updated_at: new Date().toISOString(),
    error_code: null,
  };
  activeSupabase = fakeSupabase({ user: { id: userId }, roll: revealedRoll(), awards: saved });
  const response = await awardsRoute.GET(new Request(`http://localhost/api/rolls/${rollId}/awards`), routeContext());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.generationStatus, "completed");
  assert.deepEqual(body.awards, saved.awards_json);
  assert.equal(body.canGenerate, false);
});

test("Awards API prevents a duplicate simultaneous generation for a roll", async () => {
  process.env.AWARDS_MOCK_MODE = "true";
  activeSupabase = fakeSupabase({
    user: { id: userId },
    roll: revealedRoll(),
    awards: { generation_status: "generating", updated_at: new Date().toISOString() },
  });
  const response = await awardsRoute.POST(postRequest({ photoIds: [photoIds[0]], consent: true }), routeContext());
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.code, "generation_in_progress");
  assert.equal(activeSupabase.calls.length, 0);
});

test("Awards API persists mock results with selected photo IDs and never calls Cloudflare", async () => {
  process.env.AWARDS_MOCK_MODE = "true";
  const selectedPhoto = photoIds[0];
  activeSupabase = fakeSupabase({
    user: { id: userId },
    roll: revealedRoll(),
    photos: [{ id: selectedPhoto, object_path: `u/${rollId}/${selectedPhoto}.jpg` }],
    rpcHandlers: {
      claim_roll_awards: (args) => ({ data: { state: "claimed", id: "33333333-3333-4333-8333-333333333333" }, error: null }),
      complete_roll_awards: (args) => ({ data: true, error: null }),
    },
  });
  const response = await awardsRoute.POST(postRequest({ photoIds: [selectedPhoto], consent: true }), routeContext());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.provider, "mock");
  assert.equal(body.generationStatus, "completed");
  assert.ok(body.awards.awards.every((award) => award.photoId === selectedPhoto));
  assert.deepEqual(activeSupabase.calls.map((call) => call.name), ["claim_roll_awards", "complete_roll_awards"]);
  assert.deepEqual(activeSupabase.calls[0].args.target_photo_ids, [selectedPhoto]);
  assert.equal(activeSupabase.calls[1].args.target_provider, "mock");
});

test("Awards API returns a friendly rate-limit error before contacting a provider", async () => {
  process.env.AWARDS_MOCK_MODE = "true";
  const selectedPhoto = photoIds[0];
  activeSupabase = fakeSupabase({
    user: { id: userId },
    roll: revealedRoll(),
    photos: [{ id: selectedPhoto, object_path: `u/${rollId}/${selectedPhoto}.jpg` }],
    rpcHandlers: { claim_roll_awards: () => ({ data: null, error: { message: "AWARDS_RATE_LIMIT" } }) },
  });
  const response = await awardsRoute.POST(postRequest({ photoIds: [selectedPhoto], consent: true }), routeContext());
  const body = await response.json();
  assert.equal(response.status, 429);
  assert.equal(body.code, "rate_limited");
  assert.equal(activeSupabase.calls.length, 1);
});
