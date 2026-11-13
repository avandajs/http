const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const WebSocket = require("ws");
const { Controller, Query, Event, Watchable, Streamable } = require("./build");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, timeout = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting");
    await sleep(10);
  }
}

const unhandled = [];
process.on("unhandledRejection", (e) => unhandled.push(e));
process.on("uncaughtException", (e) => unhandled.push(e));

// Node reports an unhandled rejection only after the microtask queue drains
async function assertNoUnhandled() {
  await sleep(30);
  assert.deepStrictEqual(unhandled, []);
}

const SECRET = "db password is hunter2";

// not registered as a controller: only here to prove inherited methods still resolve
class Base extends Controller {
  ping(res) {
    return res.success("pong", { from: "base" });
  }
}

class Thing extends Base {
  hello(res, req) {
    return res.success("hi", { a: 1, who: req.getParams("who") });
  }
  boom() {
    throw new Error(SECRET);
  }
  // answers through express itself, then fails
  direct(res, req) {
    req.expressRes.status(202).json({ direct: true });
    throw new Error(SECRET);
  }
  brokenStream() {
    throw new Error(SECRET);
  }
  feed(res, req) {
    const payload = req.getPayload();
    if (payload?.boom) throw new Error(SECRET);
    return payload;
  }
}

const feed = Object.getOwnPropertyDescriptor(Thing.prototype, "feed");
Object.defineProperty(
  Thing.prototype,
  "feed",
  Watchable({ event: "routes-chan" })(Thing.prototype, "feed", feed)
);

const brokenStream = Object.getOwnPropertyDescriptor(
  Thing.prototype,
  "brokenStream"
);
Object.defineProperty(
  Thing.prototype,
  "brokenStream",
  Streamable()(Thing.prototype, "brokenStream", brokenStream)
);

let server;
let origin;
let wsOrigin;

before(async () => {
  const query = new Query({
    port: "0",
    rootPath: "/graph",
    CORSWhitelist: [],
  }).execute({}, { Thing });
  server = query.server;
  await new Promise((resolve) => server.listen(0, resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  wsOrigin = `ws://127.0.0.1:${server.address().port}`;
});

const sockets = [];

after(() => {
  // a socket left open by a failed test would keep the process alive
  for (const ws of sockets) ws.terminate();
  server.close();
  server.closeAllConnections?.();
});

afterEach(assertNoUnhandled);

const graph = (service) =>
  fetch(`${origin}/graph?query=${encodeURIComponent(JSON.stringify(service))}`);

function connect(service) {
  const ws = new WebSocket(
    `${wsOrigin}/watch?query=${encodeURIComponent(JSON.stringify(service))}`
  );
  sockets.push(ws);
  ws.frames = [];
  ws.on("message", (raw) => ws.frames.push(JSON.parse(raw.toString())));
  ws.on("error", () => {});
  ws.closed = new Promise((resolve) => ws.on("close", resolve));
  return ws;
}

// the body every "no such controller / no such function" answer must have
let notFoundBody;

test("/rest/<unknown>/<x> returns 404 and no unhandledRejection", async () => {
  const r = await fetch(`${origin}/rest/xxxxxxxxxxxxxxx/xxxxxxx`, {
    method: "POST",
  });
  assert.strictEqual(r.status, 404);
  notFoundBody = await r.text();
  assert.deepStrictEqual(JSON.parse(notFoundBody), {
    msg: "Not found",
    data: null,
    status_code: 404,
    per_page: 0,
    total_pages: 1,
  });
  await assertNoUnhandled();
});

test("/rest/<known>/<unknown> returns 404 with the identical body", async () => {
  const r = await fetch(`${origin}/rest/Thing/nope`);
  assert.strictEqual(r.status, 404);
  assert.strictEqual(await r.text(), notFoundBody);
});

test("/rest/constructor/toString returns 404", async () => {
  const r = await fetch(`${origin}/rest/constructor/toString`);
  assert.strictEqual(r.status, 404);
  assert.strictEqual(await r.text(), notFoundBody);
});

test("inherited Object.prototype keys never resolve to a controller or function", async () => {
  for (const path of [
    "__proto__/toString",
    "hasOwnProperty/call",
    "toString/call",
    "Thing/constructor",
    "Thing/toString",
    "Thing/hasOwnProperty",
    "Thing/valueOf",
    "Thing/__proto__",
    "Thing/__defineGetter__",
    "Thing/connection",
  ]) {
    const r = await fetch(`${origin}/rest/${path}`);
    assert.strictEqual(r.status, 404, path);
    assert.strictEqual(await r.text(), notFoundBody, path);
  }
});

test("graph route: unknown controller and unknown function give the same 404", async () => {
  for (const service of [
    { n: "nope", f: "x", t: "s" },
    { n: "Thing", f: "nope", t: "s" },
    { n: "__proto__", f: "toString", t: "s" },
    { n: "Thing", f: "hello", t: "s", c: [{ n: "nope", f: "x", t: "s" }] },
  ]) {
    const r = await graph(service);
    assert.strictEqual(r.status, 404, JSON.stringify(service));
    assert.strictEqual(await r.text(), notFoundBody, JSON.stringify(service));
  }
});

test("graph route with query=not-json returns 400", async () => {
  for (const query of ["not-json", "null", "42", "%5B%5D"]) {
    const r = await fetch(`${origin}/graph?query=${query}`);
    assert.strictEqual(r.status, 400, query);
    const body = await r.json();
    assert.strictEqual(body.status_code, 400);
    assert.strictEqual(body.msg, "Invalid query");
    assert.strictEqual(body.data, null);
  }
});

test("a controller method that throws returns 500 without leaking the message", async () => {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  let r, text;
  try {
    r = await fetch(`${origin}/rest/Thing/boom`);
    text = await r.text();
  } finally {
    console.error = original;
  }
  assert.strictEqual(r.status, 500);
  assert.ok(!text.includes("hunter2"), text);
  assert.ok(!text.includes("routes.test.js"), text);
  assert.deepStrictEqual(JSON.parse(text), {
    msg: "Internal server error",
    data: null,
    status_code: 500,
    per_page: 0,
    total_pages: 1,
  });
  // the real error is still available server-side
  assert.ok(
    logged.some((args) => args.some((arg) => arg?.message === SECRET)),
    "the original error should be logged"
  );
});

test("a valid /rest/<known>/<known> call still returns its normal response", async () => {
  const r = await fetch(`${origin}/rest/Thing/hello?who=ade`);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), {
    msg: "hi",
    data: { a: 1, who: "ade" },
    status_code: 200,
    per_page: 0,
    total_pages: 1,
  });
});

test("a valid graph call still returns its normal response", async () => {
  const r = await graph({ n: "Thing", f: "hello", t: "s", p: 1, c: ["a"] });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), {
    msg: "hi",
    data: { a: 1 },
    status_code: 200,
    per_page: 0,
    total_pages: 1,
  });
});

test("methods inherited from a controller base class keep working", async () => {
  const r = await fetch(`${origin}/rest/Thing/ping`);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual((await r.json()).data, { from: "base" });
});

test("a controller that already responded and then throws keeps its own response", async () => {
  const original = console.error;
  console.error = () => {};
  let r;
  try {
    r = await fetch(`${origin}/rest/Thing/direct`);
  } finally {
    console.error = original;
  }
  assert.strictEqual(r.status, 202);
  assert.deepStrictEqual(await r.json(), { direct: true });
});

test("event route answers 400 when payload or event is missing", async () => {
  for (const body of [{}, { event: "x" }, { payload: "[1]" }]) {
    const r = await fetch(`${origin}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.strictEqual(r.status, 400, JSON.stringify(body));
    assert.strictEqual((await r.json()).status_code, 400);
  }
});

test("event route answers a payload it cannot emit instead of rejecting", async () => {
  const r = await fetch(`${origin}/event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // parses to a number, which can't be spread into listener arguments
    body: JSON.stringify({ event: "x", payload: "1" }),
  });
  assert.ok("error" in (await r.json()));
});

test("websocket: an unknown controller or function gets a 404 frame", async () => {
  for (const service of [
    { n: "nope", f: "x" },
    { n: "__proto__", f: "toString" },
    { n: "constructor", f: "toString" },
    { n: "Thing", f: "nope" },
  ]) {
    const ws = connect(service);
    await waitFor(() => ws.frames.length > 0);
    assert.deepStrictEqual(ws.frames[0], JSON.parse(notFoundBody));
    ws.close();
    await ws.closed;
  }
});

test("websocket: a query that isn't a service object is refused", async () => {
  const ws = connect(null);
  assert.strictEqual(await ws.closed, 1007);
});

test("websocket: a watcher that throws on an event sends a generic 500 frame", async () => {
  const original = console.error;
  console.error = () => {};
  const ws = connect({ n: "Thing", f: "feed", c: ["*"] });
  try {
    const start = Date.now();
    while (!ws.frames.some((f) => f.status_code === 500)) {
      if (Date.now() - start > 2000) throw new Error("no error frame");
      Event.emit("routes-chan", { boom: true });
      await sleep(20);
    }
    await assertNoUnhandled();
  } finally {
    console.error = original;
  }
  const frame = ws.frames.find((f) => f.status_code === 500);
  assert.strictEqual(frame.msg, "Internal server error");
  assert.ok(!JSON.stringify(ws.frames).includes("hunter2"));
  ws.close();
  await ws.closed;
});

test("websocket: graph frames answer a throwing controller with a generic 500", async () => {
  const original = console.error;
  console.error = () => {};
  const ws = connect({ n: "Thing", f: "boom" });
  try {
    // graph frames aren't answered in order, so wait for each reply
    await waitFor(() => ws.frames.length === 1);
    ws.send(JSON.stringify({ a: 1 }));
    await waitFor(() => ws.frames.length === 2);
    ws.send("not json");
    await waitFor(() => ws.frames.length === 3);
    await assertNoUnhandled();
  } finally {
    console.error = original;
  }
  const [onConnect, onFrame, badJson] = ws.frames;
  for (const frame of [onConnect, onFrame]) {
    assert.strictEqual(frame.status_code, 500);
    assert.strictEqual(frame.msg, "Internal server error");
  }
  assert.strictEqual(badJson.status_code, 400);
  assert.strictEqual(badJson.msg, "Invalid frame");
  assert.ok(!JSON.stringify(ws.frames).includes("hunter2"));
  ws.close();
  await ws.closed;
});

test("websocket: a stream that fails to start sends a generic 500 and closes 1011", async () => {
  const original = console.error;
  console.error = () => {};
  const ws = connect({ n: "Thing", f: "brokenStream" });
  let code;
  try {
    code = await ws.closed;
    await assertNoUnhandled();
  } finally {
    console.error = original;
  }
  assert.strictEqual(code, 1011);
  assert.strictEqual(ws.frames.length, 1);
  assert.strictEqual(ws.frames[0].status_code, 500);
  assert.strictEqual(ws.frames[0].msg, "Internal server error");
  assert.ok(!JSON.stringify(ws.frames).includes("hunter2"));
});
