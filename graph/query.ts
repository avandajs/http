import express, { Express } from "express";
import * as bodyParser from "body-parser";
import fileUpload from "express-fileupload";
import cors from "cors";
import * as http from "http";
import path from "path";
import Controller from "./controller";
import { Request, Response } from "../index";
import { Op, Sequelize } from "sequelize";
import { Model } from "@avanda/orm";
import Datum from "../types/Datum";
import Service from "../types/Service";
import Filters from "../types/Filters";
import { isPlainObject, omit, snakeCase } from "lodash";
import { Env, Redis, serverConfig } from "@avanda/app";
import WebSocket from "ws";
import queryString from "query-string";
import WebSocketClient from "../types/WebSocketClient";
import { v4 as uuid } from "uuid";
import AvandaWebSocket from "../types/AvandaWebSocket";
import AvandaHttpRequest from "../types/AvandaHttpRequest";
import ip from "ip";
const version = "0.3.102";
import Client from "./clients";
import Event, { EventStorageDriver } from "./event";
import { RequestMethods } from "../request";
import StreamSocket from "../socket";
import StreamableProps from "../types/StreamableProps";
import StreamHandlers from "../types/StreamHandlers";
import { streamableMetadataKey } from "../verbs/streamable";
import {
  InvalidFrameError,
  InvalidQueryError,
  clientErrorResponse,
  logRenderError,
} from "../errors";
// let CLIENTS: WebSocketClient[] = [];

/*
 *
 * The keys in the json/Service objects
 * are kept single letter to
 * make request URL as
 * short as possible
 *
 * */

export default class Query {
  app: Express = express();
  server: http.Server;
  port: number = 8080;
  watcherLatency: number = 1000;
  watcherIntervalInstance = null;
  httpPath: string = "/graph";
  websocketPath: string = "/watch";

  autoLink?: boolean;
  connection: Promise<Sequelize> | Sequelize;
  models: { [model: string]: any } = {};
  controllers: { [model: string]: typeof Controller } = {};
  serverConfig: serverConfig;
  static eventPath: string = "/event";

  constructor(serverConfig: serverConfig) {
    this.serverConfig = serverConfig;
    this.port = parseInt(serverConfig.port as string);
    this.httpPath = serverConfig.rootPath;

    return this;
  }

  isOriginAllowed(origin: string): boolean {
    return this.serverConfig.CORSWhitelist.some((entry) => {
      if (!entry.includes("*")) return entry === origin;

      const [scheme, host] = entry.split("://");
      const [originScheme, originHost] = origin.split("://");
      if (!host || !originHost || scheme !== originScheme) return false;

      const suffix = host.slice(host.indexOf("*") + 1);
      const label = originHost.slice(0, originHost.length - suffix.length);

      return (
        originHost.endsWith(suffix) &&
        label.length > 0 &&
        !label.includes(".")
      );
    });
  }

  // A request without an Origin header isn't a cross-site browser request.
  // One with an Origin must be whitelisted, or be the server's own origin.
  isRequestAllowed(origin?: string, host?: string): boolean {
    if (!origin || this.serverConfig.disableCORS) return true;
    if (this.isOriginAllowed(origin)) return true;
    return !!host && origin.split("://")[1] === host;
  }

  execute(
    models: { [k: string]: any },
    controllers: { [k: string]: any },
    eventDriver?: EventStorageDriver
  ): this {
    this.models = models;
    this.controllers = controllers;
    Event.setDriver(eventDriver);

    // before anything is parsed or run, and on every route
    this.app.use((req, res, next) => {
      if (this.isRequestAllowed(req.headers.origin, req.headers.host))
        return next();
      res.status(403).json({
        msg: "CORS Rejected",
        data: null,
        status_code: 403,
        total_pages: 0,
      });
    });

    this.app.use(
      bodyParser.json({
        verify: (req: any, res, buf) => {
          req.rawBody = buf; // Store raw body buffer for signature verification
        },
      })
    );

    this.app.use(bodyParser.json({ limit: "100mb" }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
    this.app.use(
      cors({
        credentials: true,
        // CORS headers only go to origins that pass; the others were already refused above
        origin: (origin, callback) =>
          callback(null, this.isRequestAllowed(origin)),
      })
    );
    this.app.use(
      fileUpload({
        useTempFiles: true,
      })
    );
    this.app.use(express.static("public"));

    this.app.use(
      bodyParser.json({
        verify: (req: any, res, buf) => {
          req.rawBody = buf; // Store raw body buffer for signature verification
        },
      })
    );

    this.app.post(
      Query.eventPath,
      async (req: AvandaHttpRequest, res: express.Response) => {
        // only another service holding the shared secret may emit here
        if (!Event.isAuthorized(req.headers[Event.secretHeader])) {
          const response = new Response();
          response.statusCode = 403;
          response.message = "Forbidden";
          response.data = null;
          res.status(403).json(Query.responseToObject(response));
          return;
        }

        let { payload, event } = req.body ?? {};
        if (!payload || !event || typeof event != "string") {
          const response = new Response();
          response.statusCode = 400;
          response.message = "payload and event are required";
          response.data = null;
          res.status(400).json(Query.responseToObject(response));
          return;
        }

        try {
          payload = JSON.parse(payload);
          if (!Array.isArray(payload)) {
            res.status(400).json({ error: "payload must be a JSON array" });
            return;
          }
          await Event.emitEvent(event, payload);
          res.json({ event, status: "emitted" });
        } catch (e) {
          res.json({ error: e });
        }
      }
    );

    this.app.all(
      "/rest/:service/:func",
      async (req: AvandaHttpRequest, res: express.Response) => {
        let service: Service = {
          f: req.params["func"],
          t: "s",
          n: req.params["service"],
          pr: req.query as {},
          p: 1,
          al: true,
          c: ["*"],
        };
        try {
          await this.renderServiceFromQuery(req, res, service);
        } catch (e) {
          this.sendRenderError(req, res, e);
        }
        return;
      }
    );

    // /users/:userId/books/:bookId

    this.app.all(
      this.httpPath,
      async (req: AvandaHttpRequest, res: express.Response) => {
        let query = req.query.query;

        if (query) {
          try {
            let service = Query.parseService(query);
            await this.renderServiceFromQuery(req, res, service);
          } catch (e) {
            this.sendRenderError(req, res, e);
          }
          return;
        }

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Avanda Framework</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 20px;
        }
        .highlight {
            color: #3498db;
        }
        p {
            margin-bottom: 20px;
        }
        .cta-button {
            display: inline-block;
            background-color: #3498db;
            color: #ffffff;
            padding: 10px 20px;
            border-radius: 4px;
            text-decoration: none;
            transition: background-color 0.3s ease;
        }
        .cta-button:hover {
            background-color: #2980b9;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 0.9em;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to Your <span class="highlight">Avanda</span> Framework</h1>
        <p>
            Congratulations! You've successfully set up your Avanda Project. This is your default home page, ready for you to customize and build upon.
        </p>
        <p>
            Start building your amazing application by editing this page or creating new routes in your framework.
        </p>
        <!---<a href="/docs" class="cta-button">View Documentation</a>-->
    </div>
    <div class="footer">
        <p>&copy; 2024 Avanda Framework. All rights reserved.</p>
    </div>
</body>
</html>`);
      }
    );

    //websocket watch

    this.app.all(this.websocketPath);

    this.server = http.createServer(this.app);
    // this.app.
    // this.server.

    this.startWebSocket(this.server, this.websocketPath);

    return this;
  }

  // malformed JSON, or JSON that isn't an object, is the client's mistake: 400
  private static parseService(query: unknown): Service {
    let service: unknown;
    try {
      service = JSON.parse(query as string);
    } catch (e) {
      throw new InvalidQueryError();
    }
    if (!isPlainObject(service)) throw new InvalidQueryError();
    return service as Service;
  }

  // a websocket text frame that isn't JSON is the client's mistake: 400
  private static parseFrame(frame: unknown): any {
    try {
      return JSON.parse(frame as string);
    } catch (e) {
      throw new InvalidFrameError();
    }
  }

  // the real error is logged here and never leaves the server
  private sendRenderError(
    req: AvandaHttpRequest,
    res: express.Response,
    e: unknown
  ) {
    logRenderError(`${req.method} ${req.path}`, e);
    // a controller may already have responded through expressRes
    if (res.headersSent) return;
    const response = clientErrorResponse(e);
    res.status(response.statusCode).json(Query.responseToObject(response));
  }

  async renderServiceFromQuery(
    req: AvandaHttpRequest,
    res: express.Response,
    service?: Service
  ) {
    if (Env.get("NODE_ENV") == "development") {
      console.info("[Request]: " + req.method + "/ " + req.url);
      console.info(
        "[Service]: " +
        req.method +
        "/ Service:" +
        service.n +
        " Func:" +
        service.f
      );
    }
    let request = new Request();

    request.controllers = this.controllers;
    request.models = this.models;
    request.method = req.method as RequestMethods;

    request.service = service;
    request.expressReq = req;
    request.expressRes = res;
    request.rawBody = req.rawBody;
    if (service) {
      let response = await request.generateResponseFromGraph(false);
      request.data = response;
      // the controller answered through expressRes itself, nothing left to write
      if (res.headersSent) return;
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Auth-Token, Origin, Authorization"
      );
      if (response.statusCode) {
        res.status(parseInt(response.statusCode as unknown as string));
      }

      if (response.redirectTo) {
        res.redirect(response.redirectTo);
        return;
      }

      if (response instanceof Response && response.fileBytes) {
        res.status(200).type(response.mimeType).send(response.fileBytes);
        return;
      }

      if (response instanceof Response && response.streamPath) {
        response.data = null;
        if (!path.isAbsolute(response.streamPath)) {
          response.statusCode = 500;
          response.message = "Stream path must be absolute";
          res.status(500).json(Query.responseToObject(response));
          return;
        }
        res.sendFile(
          response.streamPath,
          { headers: { "Content-Type": response.mimeType } },
          (err: any) => {
            // after headers are sent the client aborted mid-stream
            if (!err || res.headersSent) return;
            const status = [412, 416].includes(err.status) ? err.status : 404;
            response.statusCode = status;
            response.message = status == 404 ? "File not found" : err.message;
            res
              .status(status)
              .type("json")
              .json(Query.responseToObject(response));
          }
        );
        return;
      }
      let obj = Query.responseToObject(response);

      if (typeof obj == "string") {
        res.send(obj);
        return;
      }
      res.json(obj);
      return;
    }
    throw new Error("Method not implemented.");
  }

  static responseToObject(response: Response | any) {
    if (response instanceof Response) {
      return {
        msg: response.message,
        data: response.data,
        status_code: response.statusCode,
        current_page: response.currentPage,
        per_page: response.perPage,
        total_pages: response?.totalPages ?? 1,
      };
    } else {
      return response;
    }
  }

  public getServerInstance(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): http.Server {
    // this.app()

    return this.server;
  }

  private async sendResponseToClient(client: WebSocketClient) {
    if (client.busy) {
      return;
    }

    client.busy = true;
    try {
      await client.request.generateResponseFromGraph(
        true,
        client.service,
        true,
        undefined,
        undefined,
        undefined,
        "watcher",
        client.client
      );
    } catch (e) {
      logRenderError(`watch ${client.id}`, e);
      Query.sendToSocket(client.client, clientErrorResponse(e));
    } finally {
      client.busy = false;
    }
  }

  // never throws: a socket that went away or a response that can't be serialised is only logged
  private static sendToSocket(connection: AvandaWebSocket, response: any) {
    try {
      if (connection.readyState !== WebSocket.OPEN) return;
      connection.send(JSON.stringify(Query.responseToObject(response)));
    } catch (e) {
      console.error("[avanda/http] websocket send failed:", e);
    }
  }

  // close/end/aborted listeners can't await, so a failed cleanup is logged here
  private abortConnection(websocketConnection: AvandaWebSocket, code?: number) {
    this.handleConnectionAbortion(websocketConnection, code).catch((e) =>
      console.error("[avanda/http] websocket cleanup failed:", e)
    );
  }

  // frames are handed over one at a time, each waiting for the previous handler to settle
  private serveStream(client: WebSocketClient, props: StreamableProps) {
    const connection = client.client;
    const socket = new StreamSocket(connection);
    const maxPayload = props.maxPayload ?? 1024 * 1024;

    let queue: Promise<StreamHandlers | null> = client.request
      .generateResponseFromGraph(
        false,
        client.service,
        true,
        undefined,
        undefined,
        undefined,
        "watcher",
        connection
      )
      .catch((e) => {
        logRenderError(`stream ${client.id}`, e);
        socket.send(clientErrorResponse(e));
        socket.close(1011, "Stream failed");
        return null;
      });

    connection.on("message", (message: Buffer, isBinary: boolean) => {
      if (connection.readyState !== WebSocket.OPEN) return;
      if (message.length > maxPayload) {
        socket.close(1009, "Frame exceeds maxPayload");
        return;
      }

      queue = queue.then(async (handlers) => {
        try {
          if (isBinary) await handlers?.onBinary?.(message);
          else await handlers?.onMessage?.(Query.parseFrame(message.toString()));
        } catch (e) {
          logRenderError(`stream frame ${client.id}`, e);
          socket.send(clientErrorResponse(e));
        }
        return handlers;
      });
    });

    client.request.onClosedCallback = async (code) => {
      const handlers = await queue;
      try {
        await handlers?.onClose?.(code);
      } catch (e) {
        console.error("stream onClose failed:", e);
      }
    };
  }

  async handleConnectionAbortion(
    websocketConnection: AvandaWebSocket,
    code?: number
  ) {
    let closedClient = Client.activeClients.find(
      (client) => client.client.clientId == websocketConnection.clientId
    );
    if (!closedClient) return;

    try {
      await closedClient.request.onClosedCallback?.(code);
    } finally {
      await Client.remove(websocketConnection.clientId);
    }
    console.log("disconnected client: " + websocketConnection.clientId);
    if (Client.activeClients.length < 1 && this.watcherIntervalInstance) {
      // stop watch interval
      clearInterval(this.watcherIntervalInstance);
      this.watcherIntervalInstance = null;
    }
  }

  private startWebSocket(express: http.Server, path: string) {
    //

    const websocketServer = new WebSocket.Server({
      noServer: true,
      path,
    });

    express.on("upgrade", (request, socket, head) => {
      // browsers send Origin on every websocket handshake and never ask CORS first
      if (
        !this.isRequestAllowed(request.headers.origin, request.headers.host)
      ) {
        socket.end(
          "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"
        );
        return;
      }
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit("connection", websocket, request);
      });
    });

    websocketServer.on(
      "connection",
      async (websocketConnection: AvandaWebSocket, connectionRequest) => {
        const clientId = uuid();
        let request = Object.assign(
          Object.create(Object.getPrototypeOf(this.app.request)),
          this.app.request
        ) as AvandaHttpRequest;
        let response = Object.assign(
          Object.create(Object.getPrototypeOf(this.app.response)),
          this.app.response
        );
        let avandaRequest = new Request();
        let service: Service;
        try {
          const [_path, params] = connectionRequest.url.split("?");
          const connectionParams = queryString.parse(params ?? "");
          request.body = connectionParams.data
            ? JSON.parse(connectionParams.data as unknown as string)
            : undefined;
          service = Query.parseService(connectionParams.query);
        } catch (e) {
          websocketConnection.close(1007, "Invalid query or data");
          return;
        }
        request.headers = connectionRequest.headers;
        request.statusCode = connectionRequest.statusCode;
        request.statusMessage = connectionRequest.statusMessage;
        request.requestId = clientId;
        // own keys only: "__proto__" or "constructor" must not resolve to a controller
        const controller =
          typeof service.n == "string" &&
          Object.prototype.hasOwnProperty.call(this.controllers, service.n)
            ? this.controllers[service.n]
            : undefined;
        const streamable: StreamableProps | undefined =
          controller &&
          Reflect.getMetadata(
            streamableMetadataKey,
            controller.prototype,
            service.f ?? "get"
          );

        websocketConnection.clientId = clientId; //
        websocketConnection.clientIndex = Client.activeClients.length; //
        websocketConnection.service = service; //

        avandaRequest.service = service;
        avandaRequest.expressReq = request;
        avandaRequest.expressRes = response;
        avandaRequest.controllers = this.controllers;
        avandaRequest.models = this.models;
        avandaRequest.rawBody = request.rawBody;
        // avandaRequest.method
        // NOTE: connectParams are not used here but good to understand how to get
        // to them if you need to pass data with the connection to identify it (e.g., a userId).

        let client = {
          client: websocketConnection,
          id: websocketConnection.clientId,
          service: service,
          req: request,
          res: response,
          busy: false,
          request: avandaRequest,
        };

        if (streamable) {
          this.serveStream(client, streamable);
        } else {
          websocketConnection.on("message", async (message) => {
            // console.log(">>>New message to: "+ websocketConnection.clientId + ">>>> " + message)
            let res;
            try {
              request.body = message ? Query.parseFrame(message) : {};
              res = await avandaRequest.generateResponseFromGraph(false);
            } catch (e) {
              logRenderError(`frame ${clientId}`, e);
              res = clientErrorResponse(e);
            }
            Query.sendToSocket(websocketConnection, res);
          });
        }

        websocketConnection.on("close", (code: number) => {
          this.abortConnection(websocketConnection, code);
        });

        websocketConnection.on("end", (client: AvandaWebSocket) => {
          this.abortConnection(websocketConnection);
        });
        //
        websocketConnection.on("aborted", (client: AvandaWebSocket) => {
          this.abortConnection(websocketConnection);
        });

        try {
          await Client.add(client);

          console.log(">> new connection", {
            clientId,
            CLIENTS: await Client.count(),
          });
        } catch (e) {
          // the client is still tracked locally, only the shared registry missed it
          console.error("[avanda/http] websocket registry update failed:", e);
        }

        if (!streamable) this.sendResponseToClient(client);
      }
    );
    return websocketServer;
  }

  public listen() {
    if (!this.app) throw new Error("Execute before you listen");

    // without Redis, websocket clients and events stay local to this instance
    Redis.RedisClient.connect().catch((e) =>
      console.error("Redis unavailable, websocket events are local only:", e)
    );

    let ipAddress = ip.address("public");

    // network.

    this.server.listen(this.port, () => {
      // was Out.success() from @avanda/cli, which pulled a CLI toolchain into
      // every production install for this one line; same output, no dependency
      console.log(
        `\n\x1b[32m@avanda/http v${version} dev server running at:\x1b[0m`
      );
      console.log(`
> Local:    http://localhost:${this.port}/
> Network:  http://${ipAddress}:${this.port}/`);
    });

    return this.server;
  }

  // `ft` comes straight from the client. A column the controller hides must not
  // be filterable either, or its value can be read back one comparison at a time.
  static bindFilters(
    model: Model,
    filters: Filters,
    rules: { exclude?: string[]; filterable?: string[] } = {}
  ): Model {
    if (!isPlainObject(filters)) throw new InvalidQueryError();

    // column names are case-insensitive in MySQL
    const names = (columns?: string[]) =>
      (columns ?? []).map((column) => String(column).trim().toLowerCase());
    const hidden = names(rules?.exclude);
    const allowed = rules?.filterable ? names(rules.filterable) : null;

    const operators: { [k: string]: (value: any) => any } = {
      ">": (value) => ({ [Op.gt]: value }),
      "<": (value) => ({ [Op.lt]: value }),
      "==": (value) => value,
      "=": (value) => value,
      "!=": (value) => ({ [Op.ne]: value }),
      NULL: () => ({ [Op.is]: null }),
      NOTNULL: () => ({ [Op.not]: null }),
      LIKES: (value) => ({ [Op.like]: `%${value}%` }),
      NOT: (value) => ({ [Op.notLike]: `%${value}%` }),
      // accepted for older clients, never implemented
      MATCHES: () => undefined,
    };

    for (const key of Object.keys(filters)) {
      const filter = filters[key];
      const column = key.toLowerCase();
      const value = filter?.vl ?? null;

      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
        hidden.includes(column) ||
        (allowed && !allowed.includes(column)) ||
        !isPlainObject(filter) ||
        typeof filter.op != "string" ||
        !Object.prototype.hasOwnProperty.call(operators, filter.op) ||
        (value !== null &&
          !["string", "number", "boolean"].includes(typeof value))
      )
        throw new InvalidQueryError();

      const clause = operators[filter.op](value);
      if (clause !== undefined) model.where({ [key]: clause } as any);
    }

    return model;
  }
}
