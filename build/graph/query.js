"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bodyParser = __importStar(require("body-parser"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const cors_1 = __importDefault(require("cors"));
const http = __importStar(require("http"));
const index_1 = require("../index");
const ws_1 = __importDefault(require("ws"));
const query_string_1 = __importDefault(require("query-string"));
const uuid_1 = require("uuid");
const ip_1 = __importDefault(require("ip"));
const version = "0.3.102";
const cli_1 = require("@avanda/cli");
const clients_1 = __importDefault(require("./clients"));
const event_1 = __importDefault(require("./event"));
// let CLIENTS: WebSocketClient[] = [];
/*
 *
 * The keys in the json/Service objects
 * are kept single letter to
 * make request URL as
 * short as possible
 *
 * */
class Query {
    constructor(serverConfig) {
        this.app = (0, express_1.default)();
        this.port = 8080;
        this.watcherLatency = 1000;
        this.watcherIntervalInstance = null;
        this.httpPath = "/graph";
        this.websocketPath = "/watch";
        this.corsRejected = true;
        this.models = {};
        this.controllers = {};
        this.serverConfig = serverConfig;
        this.port = parseInt(serverConfig.port);
        this.httpPath = serverConfig.rootPath;
        return this;
    }
    execute(models, controllers, eventDriver) {
        this.models = models;
        this.controllers = controllers;
        event_1.default.setDriver(eventDriver);
        this.app.use(bodyParser.json({ limit: "100mb" }));
        this.app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
        this.app.use((0, cors_1.default)({
            credentials: true,
            origin: (origin, callback) => {
                if (!origin ||
                    this.serverConfig.CORSWhitelist.indexOf(origin) !== -1) {
                    this.corsRejected = false;
                    callback(null, true);
                }
                else {
                    this.corsRejected = true;
                    callback(null, true);
                }
            },
        }));
        this.app.use((0, express_fileupload_1.default)({
            useTempFiles: true,
        }));
        this.app.use(express_1.default.static("public"));
        this.app.post(Query.eventPath, async (req, res) => {
            let { payload, event } = req.body;
            if (!payload || !event)
                return;
            try {
                payload = JSON.parse(payload);
                event_1.default.emitEvent(event, payload);
                res.json({ event, status: "emitted" });
            }
            catch (e) {
                res.json({ error: e });
            }
        });
        this.app.all("/rest/:service/:func", async (req, res) => {
            let service = {
                f: req.params["func"],
                t: "s",
                n: req.params["service"],
                pr: req.query,
                p: 1,
                al: true,
                c: ["*"],
            };
            this.renderServiceFromQuery(req, res, service);
            return;
        });
        // /users/:userId/books/:bookId
        this.app.all(this.httpPath, async (req, res) => {
            let query = req.query.query;
            if (this.corsRejected && !this.serverConfig.disableCORS) {
                res.json({
                    msg: "CORS Rejected",
                    data: null,
                    status: 500,
                    total_pages: 0,
                });
                return;
            }
            else if (query) {
                let service = JSON.parse(query);
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
        });
        //websocket watch
        this.app.all(this.websocketPath);
        this.server = http.createServer(this.app);
        // this.app.
        // this.server.
        this.startWebSocket(this.server, this.websocketPath);
        return this;
    }
    async renderServiceFromQuery(req, res, service) {
        let request = new index_1.Request();
        request.controllers = this.controllers;
        request.models = this.models;
        request.method = req.method;
        request.service = service;
        request.expressReq = req;
        request.expressRes = res;
        if (service) {
            let response = await request.generateResponseFromGraph(false);
            request.data = response;
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Auth-Token, Origin, Authorization");
            if (response.statusCode) {
                res.status(parseInt(response.statusCode));
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
    static responseToObject(response) {
        var _a, _b;
        if (response instanceof index_1.Response) {
            return {
                msg: response.message,
                data: response.data,
                status_code: response.statusCode,
                current_page: response.currentPage,
                per_page: response.perPage,
                total_pages: (_a = response === null || response === void 0 ? void 0 : response.totalPages) !== null && _a !== void 0 ? _a : 1,
            };
        }
        else if (typeof response == "string") {
            return response;
        }
        else {
            return {
                msg: "Auto-generated message",
                data: response,
                status_code: 200,
                current_page: response.currentPage,
                per_page: response.perPage,
                total_pages: (_b = response === null || response === void 0 ? void 0 : response.totalPages) !== null && _b !== void 0 ? _b : 1,
            };
        }
    }
    getServerInstance(req, res) {
        // this.app()
        return this.server;
    }
    async sendResponseToClient(client) {
        if (client.busy) {
            return;
        }
        client.busy = true;
        await client.request.generateResponseFromGraph(true, client.service, true, undefined, undefined, undefined, "watcher", client.client);
        client.busy = false;
    }
    handleConnectionAbortion(websocketConnection) {
        let closedClient = clients_1.default.activeClients.find((client) => client.client.clientId == websocketConnection.clientId);
        if (typeof closedClient.request.onClosedCallback == "function")
            closedClient.request.onClosedCallback();
        clients_1.default.activeClients = clients_1.default.activeClients.filter((client) => client.client.clientId != websocketConnection.clientId);
        console.log("disconnected client: " + websocketConnection.clientId);
        if (clients_1.default.activeClients.length < 1 && this.watcherIntervalInstance) {
            // stop watch interval
            clearInterval(this.watcherIntervalInstance);
            this.watcherIntervalInstance = null;
        }
    }
    startWebSocket(express, path) {
        //
        const websocketServer = new ws_1.default.Server({
            noServer: true,
            path,
        });
        express.on("upgrade", (request, socket, head) => {
            websocketServer.handleUpgrade(request, socket, head, (websocket) => {
                websocketServer.emit("connection", websocket, request);
            });
        });
        websocketServer.on("connection", async (websocketConnection, connectionRequest) => {
            var _a;
            const [_path, params] = (_a = connectionRequest === null || connectionRequest === void 0 ? void 0 : connectionRequest.url) === null || _a === void 0 ? void 0 : _a.split("?");
            const connectionParams = query_string_1.default.parse(params);
            const clientId = (0, uuid_1.v4)();
            let request = Object.assign(Object.create(Object.getPrototypeOf(this.app.request)), this.app.request);
            let response = Object.assign(Object.create(Object.getPrototypeOf(this.app.response)), this.app.response);
            let avandaRequest = new index_1.Request();
            request.body = connectionParams.data
                ? JSON.parse(connectionParams.data)
                : undefined;
            request.headers = connectionRequest.headers;
            request.statusCode = connectionRequest.statusCode;
            request.statusMessage = connectionRequest.statusMessage;
            request.requestId = clientId;
            const service = JSON.parse(connectionParams.query);
            websocketConnection.clientId = clientId; //
            websocketConnection.clientIndex = clients_1.default.activeClients.length; //
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
                    ? JSON.parse(message)
                    : {};
                let res = await avandaRequest.generateResponseFromGraph(false);
                let obj = Query.responseToObject(res);
                websocketConnection.send(JSON.stringify(obj));
            });
            websocketConnection.on("close", (client) => {
                this.handleConnectionAbortion(websocketConnection);
            });
            websocketConnection.on("end", (client) => {
                this.handleConnectionAbortion(websocketConnection);
            });
            //
            websocketConnection.on("aborted", (client) => {
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
            clients_1.default.activeClients.push(client);
            console.log(">> new connection", {
                clientId,
                CLIENTS: clients_1.default.activeClients.length,
            });
            this.sendResponseToClient(client);
        });
        return websocketServer;
    }
    listen() {
        if (!this.app)
            throw new Error("Execute before you listen");
        let ipAddress = ip_1.default.address("public");
        // network.
        this.server.listen(this.port, () => {
            cli_1.Out.success(`@avanda/http v${version} dev server running at:`, false);
            console.log(`
> Local:    http://localhost:${this.port}/
> Network:  http://${ipAddress}:${this.port}/`);
        });
        return this.server;
    }
    static bindFilters(model, filters) {
        var _a;
        let operators;
        operators = {
            ">": (key, value, model) => {
                model.whereRaw(`${key} > ${value}`);
            },
            "<": (key, value, model) => {
                model.whereRaw(`${key} < ${value}`);
            },
            "==": (key, value, model) => {
                model.where({ [key]: value });
            },
            "=": (key, value, model) => {
                operators["=="](key, value, model);
            },
            "!=": (key, value, model) => {
                model.whereRaw(`${key} != ${value}`);
            },
            NULL: (key, value, model) => {
                model.whereColIsNull(key);
            },
            NOTNULL: (key, value, model) => {
                model.whereColIsNotNull(key);
            },
            MATCHES: (key, value, model) => {
                model.whereColumns(key).matches(value);
            },
            LIKES: (key, value, model) => {
                model.where(key).like(`%${value}%`);
            },
            NOT: (key, value, model) => {
                model.where(key).notLike("%$value%");
            },
        };
        for (let key in filters) {
            let filter = filters[key];
            let value = (_a = filter.vl) !== null && _a !== void 0 ? _a : null;
            let operator = filter.op;
            operators[operator](key, value, model);
        }
        return model;
    }
}
Query.eventPath = "/event";
exports.default = Query;
