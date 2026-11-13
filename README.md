# @avanda/http

## Two-way streaming sockets: `@Streamable`

`@Streamable` turns a controller method into a long-lived, two-way websocket. Use it for
uploads, audio/video ingestion, or any protocol where the client sends many frames and the
server answers only when it has something to say.

```ts
import { Controller, Response, Request, Streamable, StreamHandlers } from "@avanda/http";

export default class Recording extends Controller {
  @Streamable({ middlewares: [Auth], maxPayload: 4 * 1024 * 1024 })
  upload(res: Response, req: Request): StreamHandlers {
    const chunks: Buffer[] = [];
    const title = req.getData<string>("title"); // from ?data=

    return {
      onBinary: async (chunk) => {
        chunks.push(chunk);
      },
      onMessage: async (data) => {
        if (data.end) {
          const id = await save(req.getAttrs("user"), title, Buffer.concat(chunks));
          res.socket.send({ id });
          res.socket.close(1000, "done");
        }
      },
      onClose: (code) => {
        chunks.length = 0;
      },
    };
  }
}
```

### Connecting

Connect to `/watch` exactly as for `@Watchable`:

```
ws://host/watch?query={"n":"Recording","f":"upload"}&data={"title":"Intro"}
```

### Lifecycle

1. **Connect.** The middlewares run once, with the connection's headers. If one fails, the
   socket is closed with code `4401` and the middleware's message as the close reason, and the
   method is never called.
2. **Open.** The method is called once with `(res, req)`. `req` holds the middleware attrs
   (`req.getAttrs()`) and the `?data=` params (`req.getData()`). It returns the handlers below.
3. **Frames.**
   - `onBinary(chunk: Buffer)` receives binary frames as raw bytes. They are never parsed.
   - `onMessage(data)` receives text frames, JSON-parsed. Invalid JSON, or a handler that
     throws, sends an error frame (`status_code: 400`) and the socket stays open.
   - Frames are delivered in arrival order. Each handler, including async ones, finishes
     before the next frame is delivered. Frames that arrive while the method is still opening
     wait for it.
   - Nothing is sent back automatically. Reply with `res.socket.send()` when you want to.
4. **Close.** `onClose(code)` runs exactly once, whether the client or the server closes, and
   only after every queued frame has been handled.

### `res.socket`

| Member | Description |
| --- | --- |
| `id` | The connection id (same as `req.id`). |
| `send(data)` | Sends one JSON Avanda response frame (`{ msg, data, status_code, ... }`). Pass a `Response` to control `msg`/`status_code`. Ignored once the socket is closing. |
| `close(code = 1000, reason = "")` | Closes the socket. The reason is truncated to the 123-byte websocket limit. |

### Options

| Option | Default | Description |
| --- | --- | --- |
| `middlewares` | `[]` | Run once at connect; failure closes with `4401`. |
| `maxPayload` | `1048576` (1 MB) | A frame larger than this closes the socket with `1009`. The websocket server's own 100 MiB limit still applies above this. |

### Close codes

| Code | Meaning |
| --- | --- |
| `4401` | A middleware rejected the connection. |
| `1009` | A frame exceeded `maxPayload`. |
| `1011` | The method threw while opening the stream. |
| `1007` | The `?query=` or `?data=` param was not valid JSON (any `/watch` socket). |

A `@Streamable` method can only be opened over a websocket; calling it over HTTP returns an
error response.
