const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Controller, Query, Get } = require("./build");

const media = path.join(os.tmpdir(), `avanda-stream-${process.pid}.mp4`);
const size = 1000;
const bytes = Buffer.alloc(size, 7);

const authOnly = {
  boot: (res, req) =>
    req.getHeader("x-auth") === "ok"
      ? true
      : res.error("You are not logged in"),
};

class X extends Controller {
  y(res) {
    return res.stream(media, "video/mp4");
  }
  missing(res) {
    return res.stream(media + ".gone", "video/mp4");
  }
  relative(res) {
    return res.stream("some/file.mp4", "video/mp4");
  }
  guarded(res) {
    return res.stream(media, "video/mp4");
  }
  download(res) {
    return res.file(Buffer.from("hello"), "text/plain");
  }
}
for (const [name, middlewares] of [
  ["y", []],
  ["missing", []],
  ["relative", []],
  ["guarded", [authOnly]],
  ["download", []],
]) {
  const descriptor = Object.getOwnPropertyDescriptor(X.prototype, name);
  Object.defineProperty(
    X.prototype,
    name,
    Get(...middlewares)(X.prototype, name, descriptor),
  );
}

let server;
let base;

before(async () => {
  fs.writeFileSync(media, bytes);
  const query = new Query({
    port: "0",
    rootPath: "/graph",
    CORSWhitelist: [],
  }).execute({}, { X });
  server = query.server;
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}/rest/X`;
});

after(() => {
  server.close();
  fs.rmSync(media, { force: true });
});

test("no Range: 200 with full body", async () => {
  const r = await fetch(`${base}/y`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get("accept-ranges"), "bytes");
  assert.strictEqual(r.headers.get("content-type"), "video/mp4");
  assert.strictEqual(Buffer.from(await r.arrayBuffer()).length, size);
});

test("Range bytes=0-99: 206 partial", async () => {
  const r = await fetch(`${base}/y`, { headers: { Range: "bytes=0-99" } });
  assert.strictEqual(r.status, 206);
  assert.strictEqual(r.headers.get("content-range"), `bytes 0-99/${size}`);
  assert.strictEqual(r.headers.get("content-type"), "video/mp4");
  assert.strictEqual(Buffer.from(await r.arrayBuffer()).length, 100);
});

test("Range beyond size: 416", async () => {
  const r = await fetch(`${base}/y`, {
    headers: { Range: `bytes=${size + 10}-` },
  });
  assert.strictEqual(r.status, 416);
  assert.strictEqual(r.headers.get("content-range"), `bytes */${size}`);
  assert.match(r.headers.get("content-type"), /application\/json/);
  assert.strictEqual((await r.json()).status_code, 416);
});

test("missing file: 404 JSON envelope", async () => {
  const r = await fetch(`${base}/missing`);
  assert.strictEqual(r.status, 404);
  const body = await r.json();
  assert.strictEqual(body.msg, "File not found");
  assert.strictEqual(body.status_code, 404);
  assert.strictEqual(body.data, null);
});

test("relative path: 500 JSON envelope", async () => {
  const r = await fetch(`${base}/relative`);
  assert.strictEqual(r.status, 500);
  assert.strictEqual((await r.json()).msg, "Stream path must be absolute");
});

test("middleware rejection: JSON error, nothing streamed", async () => {
  const r = await fetch(`${base}/guarded`);
  assert.match(r.headers.get("content-type"), /application\/json/);
  assert.strictEqual(r.headers.get("accept-ranges"), null);
  assert.strictEqual((await r.json()).msg, "You are not logged in");
});

test("HEAD runs middleware and returns headers only", async () => {
  const rejected = await fetch(`${base}/guarded`, { method: "HEAD" });
  assert.match(rejected.headers.get("content-type"), /application\/json/);
  assert.strictEqual(rejected.headers.get("accept-ranges"), null);

  const r = await fetch(`${base}/guarded`, {
    method: "HEAD",
    headers: { "x-auth": "ok" },
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get("content-length"), String(size));
  assert.strictEqual(r.headers.get("content-type"), "video/mp4");
  assert.strictEqual((await r.arrayBuffer()).byteLength, 0);
});

test("res.file() is unchanged", async () => {
  const r = await fetch(`${base}/download`);
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/plain/);
  assert.strictEqual(await r.text(), "hello");
});
