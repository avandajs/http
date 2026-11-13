const { test, before, after } = require("node:test");
const assert = require("node:assert");
const WebSocket = require("ws");
const { Op } = require("sequelize");
const {
  Controller,
  Query,
  Event,
  Get,
  Post,
  Watchable,
} = require("./build");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

process.env.AVANDA_EVENT_SECRET = "security-test-secret";

const calls = { helper: 0, wipe: 0, override: 0, feed: 0 };
const deny = { boot: (res) => res.error("denied") };

// stands in for an @avanda/orm model: records the clauses it is given
class FakeModel {
  constructor() {
    this.clauses = [];
  }
  where(clause) {
    this.clauses.push(clause);
    return this;
  }
}

class Base extends Controller {
  shared(res) {
    return res.success("base");
  }
}

class Thing extends Base {
  open(res) {
    return res.success("ok", { id: 1 });
  }
  // never decorated
  helper(res) {
    calls.helper++;
    return res.success("helper");
  }
  // overrides a decorated method without decorating it again
  shared(res) {
    calls.override++;
    return res.success("override");
  }
  wipe(res) {
    calls.wipe++;
    return res.success("wiped");
  }
  feed(res) {
    calls.feed++;
    return res.success("feed", { secret: 42 });
  }
}

class Hidden extends Controller {
  constructor(...args) {
    super(...args);
    this.exclude = ["password"];
  }
  get(res) {
    return res.success("ok", { id: 1 });
  }
}

function decorate(target, name, decorator) {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, name);
  Object.defineProperty(
    target.prototype,
    name,
    decorator(target.prototype, name, descriptor)
  );
}
decorate(Base, "shared", Get());
decorate(Thing, "open", Get());
decorate(Thing, "wipe", Post());
decorate(Thing, "feed", Watchable({ event: "sec-chan", middlewares: [deny] }));
decorate(Hidden, "get", Get());

const ALLOWED = "https://app.example";
let server;
let host;

before(async () => {
  const query = new Query({
    port: "0",
    rootPath: "/graph",
    CORSWhitelist: [ALLOWED],
  }).execute({ Hidden: FakeModel }, { Thing, Hidden });
  server = query.server;
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  host = `127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  server.closeAllConnections?.();
});

const graph = (service, headers = {}) =>
  fetch(
    `http://${host}/graph?query=${encodeURIComponent(JSON.stringify(service))}`,
    { headers }
  );

function connect(service, headers = {}, data) {
  let url = `ws://${host}/watch?query=${encodeURIComponent(
    JSON.stringify(service)
  )}`;
  if (data) url += `&data=${encodeURIComponent(JSON.stringify(data))}`;
  const ws = new WebSocket(url, { headers });
  ws.frames = [];
  ws.on("message", (raw) => ws.frames.push(JSON.parse(raw.toString())));
  ws.result = new Promise((resolve) => {
    ws.on("open", () => resolve("open"));
    ws.on("unexpected-response", (req, res) => resolve(res.statusCode));
    ws.on("error", () => resolve("error"));
  });
  return ws;
}

test("a method no decorator registered is not an endpoint", async () => {
  for (const r of [
    await fetch(`http://${host}/rest/Thing/helper`),
    await graph({ n: "Thing", f: "helper" }),
  ])
    assert.strictEqual(r.status, 404);
  assert.strictEqual(calls.helper, 0);
});

test("an undecorated override doesn't inherit its parent's exposure", async () => {
  const r = await fetch(`http://${host}/rest/Thing/shared`);
  assert.strictEqual(r.status, 404);
  assert.strictEqual(calls.override, 0);
});

test("@Watchable middlewares also guard a plain HTTP call", async () => {
  const r = await graph({ n: "Thing", f: "feed", c: ["*"] });
  const body = await r.json();
  assert.strictEqual(body.msg, "denied");
  assert.strictEqual(body.data, null);
  assert.strictEqual(calls.feed, 0);
});

test("a websocket connect can't run a @Post method", async () => {
  const ws = connect({ n: "Thing", f: "wipe" }, {}, { target: "all" });
  assert.strictEqual(await ws.result, "open");
  await sleep(80);
  assert.strictEqual(calls.wipe, 0);
  ws.close();
});

test("a websocket handshake from an origin off the whitelist is refused", async () => {
  const refused = connect(
    { n: "Thing", f: "open" },
    { Origin: "https://evil.example" }
  );
  assert.strictEqual(await refused.result, 403);

  for (const headers of [{ Origin: ALLOWED }, {}]) {
    const ws = connect({ n: "Thing", f: "open" }, headers);
    assert.strictEqual(await ws.result, "open");
    ws.close();
  }
});

test("a request from an origin off the whitelist is refused on every route", async () => {
  const headers = { Origin: "https://evil.example" };
  for (const r of [
    await graph({ n: "Thing", f: "open", c: ["*"] }, headers),
    await fetch(`http://${host}/rest/Thing/open`, { headers }),
    await fetch(`http://${host}/event`, { method: "POST", headers }),
  ]) {
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.headers.get("access-control-allow-origin"), null);
    assert.strictEqual((await r.json()).msg, "CORS Rejected");
  }
});

test("whitelisted, same-origin and origin-less requests are served", async () => {
  const allowed = await graph(
    { n: "Thing", f: "open", c: ["*"] },
    { Origin: ALLOWED }
  );
  assert.strictEqual(allowed.status, 200);
  assert.strictEqual(
    allowed.headers.get("access-control-allow-origin"),
    ALLOWED
  );

  const same = await graph(
    { n: "Thing", f: "open", c: ["*"] },
    { Origin: `http://${host}` }
  );
  assert.strictEqual(same.status, 200);

  const none = await graph({ n: "Thing", f: "open", c: ["*"] });
  assert.strictEqual(none.status, 200);
});

test("concurrent requests don't change each other's CORS outcome", async () => {
  const service = { n: "Thing", f: "open", c: ["*"] };
  const results = await Promise.all(
    Array.from({ length: 60 }, (_, i) =>
      i % 2
        ? graph(service, { Origin: "https://evil.example" }).then((r) => [
            "evil",
            r.status,
          ])
        : graph(service).then((r) => ["none", r.status])
    )
  );
  for (const [kind, status] of results)
    assert.strictEqual(status, kind == "evil" ? 403 : 200, kind);
});

test("the event route refuses callers without the shared secret", async () => {
  const received = [];
  const listener = (payload) => received.push(payload);
  await Event.on("sec-forged", listener);
  const post = (headers) =>
    fetch(`http://${host}/event`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        event: "sec-forged",
        payload: JSON.stringify([{ forged: true }]),
      }),
    });

  assert.strictEqual((await post({})).status, 403);
  assert.strictEqual(
    (await post({ "x-avanda-event-secret": "wrong" })).status,
    403
  );
  assert.deepStrictEqual(received, []);

  const ok = await post({
    "x-avanda-event-secret": process.env.AVANDA_EVENT_SECRET,
  });
  assert.strictEqual(ok.status, 200);
  assert.deepStrictEqual(received, [{ forged: true }]);
  await Event.remove("sec-forged", listener);
});

test("the event route refuses everyone when no secret is configured", async () => {
  const secret = process.env.AVANDA_EVENT_SECRET;
  delete process.env.AVANDA_EVENT_SECRET;
  try {
    const r = await fetch(`http://${host}/event`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-avanda-event-secret": "",
      },
      body: JSON.stringify({ event: "x", payload: "[1]" }),
    });
    assert.strictEqual(r.status, 403);
  } finally {
    process.env.AVANDA_EVENT_SECRET = secret;
  }
});

test("the event route refuses a payload that isn't an array", async () => {
  const r = await fetch(`http://${host}/event`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-avanda-event-secret": process.env.AVANDA_EVENT_SECRET,
    },
    body: JSON.stringify({ event: "x", payload: "5" }),
  });
  assert.strictEqual(r.status, 400);
});

test("filters build the clause the client asked for", () => {
  const model = Query.bindFilters(new FakeModel(), {
    age: { op: ">", vl: 18 },
    name: { op: "LIKES", vl: "ade" },
    city: { op: "==", vl: "Lagos" },
    deleted_at: { op: "NULL" },
  });
  assert.deepStrictEqual(model.clauses, [
    { age: { [Op.gt]: 18 } },
    { name: { [Op.like]: "%ade%" } },
    { city: "Lagos" },
    { deleted_at: { [Op.is]: null } },
  ]);
});

test("filters on an excluded column are refused, whatever the case", () => {
  for (const key of ["password", "Password", "PASSWORD"])
    assert.throws(
      () =>
        Query.bindFilters(
          new FakeModel(),
          { [key]: { op: "LIKES", vl: "$argon2" } },
          { exclude: ["password"] }
        ),
      { code: "AVANDA_INVALID_QUERY" },
      key
    );
});

test("`filterable` narrows filters to the listed columns", () => {
  const rules = { filterable: ["name"] };
  assert.doesNotThrow(() =>
    Query.bindFilters(new FakeModel(), { name: { op: "=", vl: "a" } }, rules)
  );
  assert.throws(
    () =>
      Query.bindFilters(new FakeModel(), { email: { op: "=", vl: "a" } }, rules),
    { code: "AVANDA_INVALID_QUERY" }
  );
});

test("malformed filters are refused instead of being guessed at", () => {
  for (const filters of [
    { "a.b": { op: "=", vl: 1 } },
    { "name; drop": { op: "=", vl: 1 } },
    { name: { op: "nope", vl: 1 } },
    { name: { op: "constructor", vl: 1 } },
    { name: { op: "=", vl: { nested: true } } },
    { name: { op: "=", vl: [1, 2] } },
    { name: "x" },
    [],
    "x",
  ])
    assert.throws(
      () => Query.bindFilters(new FakeModel(), filters),
      { code: "AVANDA_INVALID_QUERY" },
      JSON.stringify(filters)
    );
});

test("a request filtering on an excluded column gets a 400", async () => {
  const hidden = await graph({
    n: "Hidden",
    f: "get",
    c: ["*"],
    ft: { password: { op: "LIKES", vl: "a" } },
  });
  assert.strictEqual(hidden.status, 400);

  const visible = await graph({
    n: "Hidden",
    f: "get",
    c: ["*"],
    ft: { id: { op: "=", vl: 1 } },
  });
  assert.strictEqual(visible.status, 200);
});
