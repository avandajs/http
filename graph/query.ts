import express, { Express } from "express";
import * as bodyParser from "body-parser";
import fileUpload from "express-fileupload";
import cors from "cors";
import * as http from "http";
import Controller from "./controller";
import { Request, Response } from "../index";
import { Sequelize } from "sequelize";
import { Model } from "@avanda/orm";
import Datum from "../types/Datum";
import Service from "../types/Service";
import Filters from "../types/Filters";
import { isPlainObject, omit, snakeCase } from "lodash";
import { serverConfig } from "@avanda/app";
import WebSocket from "ws";
import queryString from "query-string";
import WebSocketClient from "../types/WebSocketClient";
import { v4 as uuid } from "uuid";
import AvandaWebSocket from "../types/AvandaWebSocket";
import AvandaHttpRequest from "../types/AvandaHttpRequest";
import ip from "ip";
const version = "0.3.102";
import { Out } from "@avanda/cli";
import Client from "./clients";
import Event, { EventStorageDriver } from "./event";
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
  corsRejected?: boolean = true;
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

  execute(
    models: { [k: string]: any },
    controllers: { [k: string]: any },
    eventDriver?: EventStorageDriver
  ): this {
    this.models = models;
    this.controllers = controllers;
    Event.setDriver(eventDriver);

    this.app.use(bodyParser.json({ limit: "100mb" }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
    this.app.use(
      cors({
        credentials: true,
        origin: (origin, callback) => {
          if (
            !origin ||
            this.serverConfig.CORSWhitelist.indexOf(origin) !== -1
          ) {
            this.corsRejected = false;
            callback(null, true);
          } else {
            this.corsRejected = true;
            callback(null, true);
          }
        },
      })
    );
    this.app.use(
      fileUpload({
        useTempFiles: true,
      })
    );
    this.app.use(express.static("public"));

    this.app.post(
      Query.eventPath,
      async (req: AvandaHttpRequest, res: express.Response) => {
        let { payload, event } = req.body;
        if (!payload || !event) return;

        try {
          payload = JSON.parse(payload);
          Event.emitEvent(event, payload);
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
        this.renderServiceFromQuery(req, res, service);
        return;
      }
    );

    // /users/:userId/books/:bookId

    this.app.all(
      this.httpPath,
      async (req: AvandaHttpRequest, res: express.Response) => {
        let query = req.query.query as string;

        if (this.corsRejected && !this.serverConfig.disableCORS) {
          res.json({
            msg: "CORS Rejected",
            data: null,
            status: 500,
            total_pages: 0,
          });
          return;
        } else if (query) {
          let service = JSON.parse(query) as Service;
          this.renderServiceFromQuery(req, res, service);
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
  async renderServiceFromQuery(
    req: AvandaHttpRequest,
    res: express.Response,
    service?: Service
  ) {
    let request = new Request();

    request.controllers = this.controllers;
    request.models = this.models;
    request.method = req.method;

    request.service = service;
    request.expressReq = req;
    request.expressRes = res;
    if (service) {
      let response = await request.generateResponseFromGraph(false);
      request.data = response;
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Auth-Token, Origin, Authorization"
      );
      if (response.statusCode) {
        res.status(parseInt(response.statusCode as unknown as string));
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
    } else if (typeof response == "string") {
      return response;
    } else {
      return {
        msg: "Auto-generated message",
        data: response,
        status_code: 200,
        current_page: response.currentPage,
        per_page: response.perPage,
        total_pages: response?.totalPages ?? 1,
      };
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

    client.busy = false;
  }

  handleConnectionAbortion(websocketConnection: AvandaWebSocket) {
    let closedClient = Client.activeClients.find(
      (client) => client.client.clientId == websocketConnection.clientId
    );
    if (typeof closedClient.request.onClosedCallback == "function")
      closedClient.request.onClosedCallback();

    Client.activeClients = Client.activeClients.filter(
      (client) => client.client.clientId != websocketConnection.clientId
    );
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
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit("connection", websocket, request);
      });
    });

    websocketServer.on(
      "connection",
      async (websocketConnection: AvandaWebSocket, connectionRequest) => {
        const [_path, params] = connectionRequest?.url?.split("?");
        const connectionParams = queryString.parse(params);
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
        request.body = connectionParams.data
          ? JSON.parse(connectionParams.data as unknown as string)
          : undefined;
        request.headers = connectionRequest.headers;
        request.statusCode = connectionRequest.statusCode;
        request.statusMessage = connectionRequest.statusMessage;
        request.requestId = clientId;
        const service = JSON.parse(
          connectionParams.query as unknown as string
        ) as unknown as Service;

        websocketConnection.clientId = clientId; //
        websocketConnection.clientIndex = Client.activeClients.length; //
        websocketConnection.service = service; //

        avandaRequest.service = service;
        avandaRequest.expressReq = request;
        avandaRequest.expressRes = response;
        avandaRequest.controllers = this.controllers;
        avandaRequest.models = this.models;
        // avandaRequest.method
        // NOTE: connectParams are not used here but good to understand how to get
        // to them if you need to pass data with the connection to identify it (e.g., a userId).

        websocketConnection.on("message", async (message) => {
          // console.log(">>>New message to: "+ websocketConnection.clientId + ">>>> " + message)
          request.body = message
            ? JSON.parse(message as unknown as string)
            : {};
          let res = await avandaRequest.generateResponseFromGraph(false);
          let obj = Query.responseToObject(res);
          websocketConnection.send(JSON.stringify(obj));
        });

        websocketConnection.on("close", (client: AvandaWebSocket) => {
          this.handleConnectionAbortion(websocketConnection);
        });

        websocketConnection.on("end", (client: AvandaWebSocket) => {
          this.handleConnectionAbortion(websocketConnection);
        });
        //
        websocketConnection.on("aborted", (client: AvandaWebSocket) => {
          this.handleConnectionAbortion(websocketConnection);
        });

        let client = {
          client: websocketConnection,
          id: websocketConnection.clientId,
          service: service,
          req: request,
          res: response,
          busy: false,
          request: avandaRequest,
        };

        Client.activeClients.push(client);

        console.log(">> new connection", {
          clientId,
          CLIENTS: Client.activeClients.length,
        });

        this.sendResponseToClient(client);
      }
    );
    return websocketServer;
  }

  public listen() {
    if (!this.app) throw new Error("Execute before you listen");

    let ipAddress = ip.address("public");

    // network.

    this.server.listen(this.port, () => {
      Out.success(`@avanda/http v${version} dev server running at:`, false);
      console.log(`
> Local:    http://localhost:${this.port}/
> Network:  http://${ipAddress}:${this.port}/`);
    });

    return this.server;
  }

  static bindFilters(model: Model, filters: Filters): Model {
    let operators: {
      [k: string]: (key: string, value: any, model: Model) => void;
    };
    operators = {
      ">": (key: string, value: any, model: Model) => {
        model.whereRaw(`${key} > ${value}`);
      },
      "<": (key: string, value: any, model: Model) => {
        model.whereRaw(`${key} < ${value}`);
      },
      "==": (key: string, value: any, model: Model) => {
        model.where({ [key]: value });
      },
      "=": (key: string, value: any, model: Model) => {
        operators["=="](key, value, model);
      },
      "!=": (key: string, value: any, model: Model) => {
        model.whereRaw(`${key} != ${value}`);
      },
      NULL: (key: string, value: any, model: Model) => {
        model.whereColIsNull<string>(key);
      },
      NOTNULL: (key: string, value: any, model: Model) => {
        model.whereColIsNotNull<string>(key);
      },
      MATCHES: (key: string, value: any, model: Model) => {
        model.whereColumns(key).matches(value);
      },
      LIKES: (key: string, value: any, model: Model) => {
        model.where(key).like(`%${value}%`);
      },
      NOT: (key: string, value: any, model: Model) => {
        model.where(key).notLike("%$value%");
      },
    };
    for (let key in filters) {
      let filter = filters[key];
      let value = filter.vl ?? null;
      let operator = filter.op;

      operators[operator](key, value, model);
    }

    return model;
  }
}
