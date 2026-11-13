const { test, before, after } = require("node:test");
const assert = require("node:assert");
const WebSocket = require("ws");
const {
  Controller,
  Query,
  Event,
  Get,
  Watchable,
  Streamable,
} = require("./build");

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

const closes = {};
const calls = { guarded: 0, secret: 0, watchBoot: 0, tinyChunks: 0 };

const authOnly = {
  boot: (res, req) => {
    if (req.getHeader("x-auth") !== "ok")
      return res.error("You are not logged in");
    req.setAttr("user", "ade");
    return true;
  },
};

const watchAuth = {
  boot: (res) => {
    calls.watchBoot++;
    return res.error("You are not logged in");
  },
};

class S extends Controller {
  upload(res) {
    const received = [];
    // early chunks are the slowest, so unserialised delivery would reorder them
    let delay = 60;
    res.socket.send({ id: res.socket.id });
    return {
      onBinary: async (chunk) => {
        await sleep((delay = Math.max(delay - 15, 0)));
        received.push(chunk[0]);
      },
      onMessage: async (data) => {
        if (data.boom) throw new Error("boom");
        if (data.end) res.socket.send({ order: received });
        if (data.close) res.socket.close(1000, "bye");
      },
      onClose: (code) => {
        closes[res.socket.id] = (closes[res.socket.id] ?? 0) + 1;
      },
    };
  }
  guarded(res, req) {
    calls.guarded++;
    res.socket.send({ user: req.getAttrs("user"), x: req.getData("x") });
    return {};
  }
  tiny() {
    return { onBinary: () => calls.tinyChunks++ };
  }
}

class X extends Controller {
  echo(res, req) {
    return res.success("ok", req.data);
  }
  secret() {
    calls.secret++;
    return "secret";
  }
}

class W extends Controller {
  feed(res, req) {
    return req.getPayload();
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
decorate(S, "upload", Streamable());
decorate(S, "guarded", Streamable({ middlewares: [authOnly] }));
decorate(S, "tiny", Streamable({ maxPayload: 8 }));
decorate(X, "echo", Get());
decorate(X, "secret", Get(watchAuth));
decorate(W, "feed", Watchable({ event: "chan" }));

let server;
let port;

before(async () => {
  const query = new Query({
    port: "0",
    rootPath: "/graph",
    CORSWhitelist: [],
  }).execute({}, { S, X, W });
  server = query.server;
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

after(() => {
  server.close();
  assert.deepStrictEqual(unhandled, []);
});

function connect(service, { data, headers } = {}) {
  let url = `ws://127.0.0.1:${port}/watch?query=${encodeURIComponent(
    JSON.stringify(service)
  )}`;
  if (data) url += `&data=${encodeURIComponent(JSON.stringify(data))}`;
  const ws = new WebSocket(url, { headers });
  ws.frames = [];
  ws.on("message", (raw) => ws.frames.push(JSON.parse(raw.toString())));
  ws.closed = new Promise((resolve) =>
    ws.on("close", (code, reason) =>
      resolve({ code, reason: reason.toString() })
    )
  );
  ws.opened = new Promise((resolve) => ws.on("open", resolve));
  return ws;
}

test("binary frames then {end:true} arrive in order despite slow handlers", async () => {
  const ws = connect({ n: "S", f: "upload" });
  await ws.opened;
  for (let i = 0; i < 6; i++) ws.send(Buffer.from([i]));
  ws.send(JSON.stringify({ end: true }));

  await waitFor(() => ws.frames.some((f) => f.data?.order));
  const done = ws.frames.find((f) => f.data?.order);
  assert.deepStrictEqual(done.data.order, [0, 1, 2, 3, 4, 5]);
  assert.strictEqual(done.status_code, 200);
  // no automatic reply per frame: only the connect frame and the end frame
  assert.strictEqual(ws.frames.length, 2);
  ws.close();
});

test("onClose runs exactly once, whoever closes", async () => {
  const ws = connect({ n: "S", f: "upload" });
  await waitFor(() => ws.frames.length > 0);
  const id = ws.frames[0].data.id;

  // server and client both close at once
  ws.send(JSON.stringify({ close: true }));
  ws.close(1000);
  await ws.closed;
  await waitFor(() => closes[id] === 1);
  await sleep(100);
  assert.strictEqual(closes[id], 1);

  const other = connect({ n: "S", f: "upload" });
  await waitFor(() => other.frames.length > 0);
  const otherId = other.frames[0].data.id;
  other.send(JSON.stringify({ close: true }));
  assert.strictEqual((await other.closed).code, 1000);
  await waitFor(() => closes[otherId] === 1);
  await sleep(100);
  assert.strictEqual(closes[otherId], 1);
});

test("bad JSON and a throwing handler get error frames and the socket survives", async () => {
  const ws = connect({ n: "S", f: "upload" });
  await ws.opened;
  ws.send("not json");
  ws.send(JSON.stringify({ boom: true }));
  ws.send(JSON.stringify({ end: true }));

  await waitFor(() => ws.frames.length === 4);
  const [, badJson, boom, done] = ws.frames;
  assert.strictEqual(badJson.status_code, 400);
  assert.strictEqual(badJson.msg, "Invalid frame");
  // what a handler throws is logged server-side, never sent to the client
  assert.strictEqual(boom.status_code, 500);
  assert.strictEqual(boom.msg, "Internal server error");
  assert.deepStrictEqual(done.data.order, []);
  ws.close();
});

test("failed middleware closes with 4401 and never calls the method", async () => {
  const before = calls.guarded;
  const ws = connect({ n: "S", f: "guarded" });
  const { code, reason } = await ws.closed;
  assert.strictEqual(code, 4401);
  assert.strictEqual(reason, "You are not logged in");
  assert.strictEqual(calls.guarded, before);
});

test("passing middleware: method gets attrs and ?data= params", async () => {
  const ws = connect(
    { n: "S", f: "guarded" },
    { data: { x: 42 }, headers: { "x-auth": "ok" } }
  );
  await waitFor(() => ws.frames.length > 0);
  assert.deepStrictEqual(ws.frames[0].data, { user: "ade", x: 42 });
  ws.close();
});

test("an oversized frame closes with 1009", async () => {
  const ws = connect({ n: "S", f: "tiny" });
  await ws.opened;
  ws.send(Buffer.alloc(8));
  ws.send(Buffer.alloc(9));
  assert.strictEqual((await ws.closed).code, 1009);
  await sleep(50);
  assert.strictEqual(calls.tinyChunks, 1);
});

test("graph frames still get one reply each, bad JSON included", async () => {
  const ws = connect({ n: "X", f: "echo", c: ["*"] });
  await ws.opened;
  ws.send("nope");
  ws.send(JSON.stringify({ a: 1 }));
  await waitFor(() => ws.frames.length === 2);
  assert.strictEqual(ws.frames[0].status_code, 400);
  assert.deepStrictEqual(ws.frames[1].data, { a: 1 });
  ws.close();
});

test("a watcher whose middleware fails doesn't run the method", async () => {
  const ws = connect({ n: "X", f: "secret" });
  await waitFor(() => calls.watchBoot > 0);
  await sleep(50);
  assert.strictEqual(calls.secret, 0);
  ws.close();
});

async function emitUntil(ws, n) {
  const start = Date.now();
  while (!ws.frames.some((f) => f.n === n)) {
    if (Date.now() - start > 2000) throw new Error(`no event ${n} received`);
    Event.emit("chan", { n });
    await sleep(20);
  }
}

test("@Watchable still delivers events", async () => {
  const ws = connect({ n: "W", f: "feed", c: ["*"] });
  await emitUntil(ws, 1);
  ws.close();
  await ws.closed;
});

test("closing one of two sockets on a channel leaves the other receiving", async () => {
  const a = connect({ n: "W", f: "feed", c: ["*"] });
  const b = connect({ n: "W", f: "feed", c: ["*"] });
  await emitUntil(a, 2);
  await emitUntil(b, 2);

  a.close();
  await a.closed;
  await sleep(100);
  await emitUntil(b, 3);
  b.close();
});

test("Event.remove drops only the given callback", async () => {
  const got = [];
  const first = (p) => got.push(["first", p]);
  const second = (p) => got.push(["second", p]);
  await Event.on("solo", first);
  await Event.on("solo", second);
  await Event.remove("solo", first);
  await Event.emit("solo", 1);
  assert.deepStrictEqual(got, [["second", 1]]);
  await Event.remove("solo", second);
});
