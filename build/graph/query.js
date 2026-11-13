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
const path_1 = __importDefault(require("path"));
const index_1 = require("../index");
const sequelize_1 = require("sequelize");
const lodash_1 = require("lodash");
const app_1 = require("@avanda/app");
const ws_1 = __importDefault(require("ws"));
const query_string_1 = __importDefault(require("query-string"));
const uuid_1 = require("uuid");
const ip_1 = __importDefault(require("ip"));
const version = "0.3.102";
const clients_1 = __importDefault(require("./clients"));
const event_1 = __importDefault(require("./event"));
const socket_1 = __importDefault(require("../socket"));
const streamable_1 = require("../verbs/streamable");
const errors_1 = require("../errors");
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
        this.models = {};
        this.controllers = {};
        this.serverConfig = serverConfig;
        this.port = parseInt(serverConfig.port);
        this.httpPath = serverConfig.rootPath;
        return this;
    }
    isOriginAllowed(origin) {
        return this.serverConfig.CORSWhitelist.some((entry) => {
            if (!entry.includes("*"))
                return entry === origin;
            const [scheme, host] = entry.split("://");
            const [originScheme, originHost] = origin.split("://");
            if (!host || !originHost || scheme !== originScheme)
                return false;
            const suffix = host.slice(host.indexOf("*") + 1);
            const label = originHost.slice(0, originHost.length - suffix.length);
            return (originHost.endsWith(suffix) &&
                label.length > 0 &&
                !label.includes("."));
        });
    }
    // A request without an Origin header isn't a cross-site browser request.
    // One with an Origin must be whitelisted, or be the server's own origin.
    isRequestAllowed(origin, host) {
        if (!origin || this.serverConfig.disableCORS)
            return true;
        if (this.isOriginAllowed(origin))
            return true;
        return !!host && origin.split("://")[1] === host;
    }
    execute(models, controllers, eventDriver) {
        this.models = models;
        this.controllers = controllers;
        event_1.default.setDriver(eventDriver);
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
        this.app.use(bodyParser.json({
            verify: (req, res, buf) => {
                req.rawBody = buf; // Store raw body buffer for signature verification
            },
        }));
        this.app.use(bodyParser.json({ limit: "100mb" }));
        this.app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
        this.app.use((0, cors_1.default)({
            credentials: true,
            // CORS headers only go to origins that pass; the others were already refused above
            origin: (origin, callback) => callback(null, this.isRequestAllowed(origin)),
        }));
        this.app.use((0, express_fileupload_1.default)({
            useTempFiles: true,
        }));
        this.app.use(express_1.default.static("public"));
        this.app.use(bodyParser.json({
            verify: (req, res, buf) => {
                req.rawBody = buf; // Store raw body buffer for signature verification
            },
        }));
        this.app.post(Query.eventPath, async (req, res) => {
            var _a;
            // only another service holding the shared secret may emit here
            if (!event_1.default.isAuthorized(req.headers[event_1.default.secretHeader])) {
                const response = new index_1.Response();
                response.statusCode = 403;
                response.message = "Forbidden";
                response.data = null;
                res.status(403).json(Query.responseToObject(response));
                return;
            }
            let { payload, event } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
            if (!payload || !event || typeof event != "string") {
                const response = new index_1.Response();
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
                await event_1.default.emitEvent(event, payload);
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
            try {
                await this.renderServiceFromQuery(req, res, service);
            }
            catch (e) {
                this.sendRenderError(req, res, e);
            }
            return;
        });
        // /users/:userId/books/:bookId
        this.app.all(this.httpPath, async (req, res) => {
            let query = req.query.query;
            if (query) {
                try {
                    let service = Query.parseService(query);
                    await this.renderServiceFromQuery(req, res, service);
                }
                catch (e) {
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
        });
        //websocket watch
        this.app.all(this.websocketPath);
        this.server = http.createServer(this.app);
        // this.app.
        // this.server.
        this.startWebSocket(this.server, this.websocketPath);
        return this;
    }
    // malformed JSON, or JSON that isn't an object, is the client's mistake: 400
    static parseService(query) {
        let service;
        try {
            service = JSON.parse(query);
        }
        catch (e) {
            throw new errors_1.InvalidQueryError();
        }
        if (!(0, lodash_1.isPlainObject)(service))
            throw new errors_1.InvalidQueryError();
        return service;
    }
    // a websocket text frame that isn't JSON is the client's mistake: 400
    static parseFrame(frame) {
        try {
            return JSON.parse(frame);
        }
        catch (e) {
            throw new errors_1.InvalidFrameError();
        }
    }
    // the real error is logged here and never leaves the server
    sendRenderError(req, res, e) {
        (0, errors_1.logRenderError)(`${req.method} ${req.path}`, e);
        // a controller may already have responded through expressRes
        if (res.headersSent)
            return;
        const response = (0, errors_1.clientErrorResponse)(e);
        res.status(response.statusCode).json(Query.responseToObject(response));
    }
    async renderServiceFromQuery(req, res, service) {
        if (app_1.Env.get("NODE_ENV") == "development") {
            console.info("[Request]: " + req.method + "/ " + req.url);
            console.info("[Service]: " +
                req.method +
                "/ Service:" +
                service.n +
                " Func:" +
                service.f);
        }
        let request = new index_1.Request();
        request.controllers = this.controllers;
        request.models = this.models;
        request.method = req.method;
        request.service = service;
        request.expressReq = req;
        request.expressRes = res;
        request.rawBody = req.rawBody;
        if (service) {
            let response = await request.generateResponseFromGraph(false);
            request.data = response;
            // the controller answered through expressRes itself, nothing left to write
            if (res.headersSent)
                return;
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Auth-Token, Origin, Authorization");
            if (response.statusCode) {
                res.status(parseInt(response.statusCode));
            }
            if (response.redirectTo) {
                res.redirect(response.redirectTo);
                return;
            }
            if (response instanceof index_1.Response && response.fileBytes) {
                res.status(200).type(response.mimeType).send(response.fileBytes);
                return;
            }
            if (response instanceof index_1.Response && response.streamPath) {
                response.data = null;
                if (!path_1.default.isAbsolute(response.streamPath)) {
                    response.statusCode = 500;
                    response.message = "Stream path must be absolute";
                    res.status(500).json(Query.responseToObject(response));
                    return;
                }
                res.sendFile(response.streamPath, { headers: { "Content-Type": response.mimeType } }, (err) => {
                    // after headers are sent the client aborted mid-stream
                    if (!err || res.headersSent)
                        return;
                    const status = [412, 416].includes(err.status) ? err.status : 404;
                    response.statusCode = status;
                    response.message = status == 404 ? "File not found" : err.message;
                    res
                        .status(status)
                        .type("json")
                        .json(Query.responseToObject(response));
                });
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
    static responseToObject(response) {
        var _a;
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
        else {
            return response;
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
        try {
            await client.request.generateResponseFromGraph(true, client.service, true, undefined, undefined, undefined, "watcher", client.client);
        }
        catch (e) {
            (0, errors_1.logRenderError)(`watch ${client.id}`, e);
            Query.sendToSocket(client.client, (0, errors_1.clientErrorResponse)(e));
        }
        finally {
            client.busy = false;
        }
    }
    // never throws: a socket that went away or a response that can't be serialised is only logged
    static sendToSocket(connection, response) {
        try {
            if (connection.readyState !== ws_1.default.OPEN)
                return;
            connection.send(JSON.stringify(Query.responseToObject(response)));
        }
        catch (e) {
            console.error("[avanda/http] websocket send failed:", e);
        }
    }
    // close/end/aborted listeners can't await, so a failed cleanup is logged here
    abortConnection(websocketConnection, code) {
        this.handleConnectionAbortion(websocketConnection, code).catch((e) => console.error("[avanda/http] websocket cleanup failed:", e));
    }
    // frames are handed over one at a time, each waiting for the previous handler to settle
    serveStream(client, props) {
        var _a;
        const connection = client.client;
        const socket = new socket_1.default(connection);
        const maxPayload = (_a = props.maxPayload) !== null && _a !== void 0 ? _a : 1024 * 1024;
        let queue = client.request
            .generateResponseFromGraph(false, client.service, true, undefined, undefined, undefined, "watcher", connection)
            .catch((e) => {
            (0, errors_1.logRenderError)(`stream ${client.id}`, e);
            socket.send((0, errors_1.clientErrorResponse)(e));
            socket.close(1011, "Stream failed");
            return null;
        });
        connection.on("message", (message, isBinary) => {
            if (connection.readyState !== ws_1.default.OPEN)
                return;
            if (message.length > maxPayload) {
                socket.close(1009, "Frame exceeds maxPayload");
                return;
            }
            queue = queue.then(async (handlers) => {
                var _a, _b;
                try {
                    if (isBinary)
                        await ((_a = handlers === null || handlers === void 0 ? void 0 : handlers.onBinary) === null || _a === void 0 ? void 0 : _a.call(handlers, message));
                    else
                        await ((_b = handlers === null || handlers === void 0 ? void 0 : handlers.onMessage) === null || _b === void 0 ? void 0 : _b.call(handlers, Query.parseFrame(message.toString())));
                }
                catch (e) {
                    (0, errors_1.logRenderError)(`stream frame ${client.id}`, e);
                    socket.send((0, errors_1.clientErrorResponse)(e));
                }
                return handlers;
            });
        });
        client.request.onClosedCallback = async (code) => {
            var _a;
            const handlers = await queue;
            try {
                await ((_a = handlers === null || handlers === void 0 ? void 0 : handlers.onClose) === null || _a === void 0 ? void 0 : _a.call(handlers, code));
            }
            catch (e) {
                console.error("stream onClose failed:", e);
            }
        };
    }
    async handleConnectionAbortion(websocketConnection, code) {
        var _a, _b;
        let closedClient = clients_1.default.activeClients.find((client) => client.client.clientId == websocketConnection.clientId);
        if (!closedClient)
            return;
        try {
            await ((_b = (_a = closedClient.request).onClosedCallback) === null || _b === void 0 ? void 0 : _b.call(_a, code));
        }
        finally {
            await clients_1.default.remove(websocketConnection.clientId);
        }
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
            // browsers send Origin on every websocket handshake and never ask CORS first
            if (!this.isRequestAllowed(request.headers.origin, request.headers.host)) {
                socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
                return;
            }
            websocketServer.handleUpgrade(request, socket, head, (websocket) => {
                websocketServer.emit("connection", websocket, request);
            });
        });
        websocketServer.on("connection", async (websocketConnection, connectionRequest) => {
            var _a;
            const clientId = (0, uuid_1.v4)();
            let request = Object.assign(Object.create(Object.getPrototypeOf(this.app.request)), this.app.request);
            let response = Object.assign(Object.create(Object.getPrototypeOf(this.app.response)), this.app.response);
            let avandaRequest = new index_1.Request();
            let service;
            try {
                const [_path, params] = connectionRequest.url.split("?");
                const connectionParams = query_string_1.default.parse(params !== null && params !== void 0 ? params : "");
                request.body = connectionParams.data
                    ? JSON.parse(connectionParams.data)
                    : undefined;
                service = Query.parseService(connectionParams.query);
            }
            catch (e) {
                websocketConnection.close(1007, "Invalid query or data");
                return;
            }
            request.headers = connectionRequest.headers;
            request.statusCode = connectionRequest.statusCode;
            request.statusMessage = connectionRequest.statusMessage;
            request.requestId = clientId;
            // own keys only: "__proto__" or "constructor" must not resolve to a controller
            const controller = typeof service.n == "string" &&
                Object.prototype.hasOwnProperty.call(this.controllers, service.n)
                ? this.controllers[service.n]
                : undefined;
            const streamable = controller &&
                Reflect.getMetadata(streamable_1.streamableMetadataKey, controller.prototype, (_a = service.f) !== null && _a !== void 0 ? _a : "get");
            websocketConnection.clientId = clientId; //
            websocketConnection.clientIndex = clients_1.default.activeClients.length; //
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
            }
            else {
                websocketConnection.on("message", async (message) => {
                    // console.log(">>>New message to: "+ websocketConnection.clientId + ">>>> " + message)
                    let res;
                    try {
                        request.body = message ? Query.parseFrame(message) : {};
                        res = await avandaRequest.generateResponseFromGraph(false);
                    }
                    catch (e) {
                        (0, errors_1.logRenderError)(`frame ${clientId}`, e);
                        res = (0, errors_1.clientErrorResponse)(e);
                    }
                    Query.sendToSocket(websocketConnection, res);
                });
            }
            websocketConnection.on("close", (code) => {
                this.abortConnection(websocketConnection, code);
            });
            websocketConnection.on("end", (client) => {
                this.abortConnection(websocketConnection);
            });
            //
            websocketConnection.on("aborted", (client) => {
                this.abortConnection(websocketConnection);
            });
            try {
                await clients_1.default.add(client);
                console.log(">> new connection", {
                    clientId,
                    CLIENTS: await clients_1.default.count(),
                });
            }
            catch (e) {
                // the client is still tracked locally, only the shared registry missed it
                console.error("[avanda/http] websocket registry update failed:", e);
            }
            if (!streamable)
                this.sendResponseToClient(client);
        });
        return websocketServer;
    }
    listen() {
        if (!this.app)
            throw new Error("Execute before you listen");
        // without Redis, websocket clients and events stay local to this instance
        app_1.Redis.RedisClient.connect().catch((e) => console.error("Redis unavailable, websocket events are local only:", e));
        let ipAddress = ip_1.default.address("public");
        // network.
        this.server.listen(this.port, () => {
            // was Out.success() from @avanda/cli, which pulled a CLI toolchain into
            // every production install for this one line; same output, no dependency
            console.log(`\n\x1b[32m@avanda/http v${version} dev server running at:\x1b[0m`);
            console.log(`
> Local:    http://localhost:${this.port}/
> Network:  http://${ipAddress}:${this.port}/`);
        });
        return this.server;
    }
    // `ft` comes straight from the client. A column the controller hides must not
    // be filterable either, or its value can be read back one comparison at a time.
    static bindFilters(model, filters, rules = {}) {
        var _a;
        if (!(0, lodash_1.isPlainObject)(filters))
            throw new errors_1.InvalidQueryError();
        // column names are case-insensitive in MySQL
        const names = (columns) => (columns !== null && columns !== void 0 ? columns : []).map((column) => String(column).trim().toLowerCase());
        const hidden = names(rules === null || rules === void 0 ? void 0 : rules.exclude);
        const allowed = (rules === null || rules === void 0 ? void 0 : rules.filterable) ? names(rules.filterable) : null;
        const operators = {
            ">": (value) => ({ [sequelize_1.Op.gt]: value }),
            "<": (value) => ({ [sequelize_1.Op.lt]: value }),
            "==": (value) => value,
            "=": (value) => value,
            "!=": (value) => ({ [sequelize_1.Op.ne]: value }),
            NULL: () => ({ [sequelize_1.Op.is]: null }),
            NOTNULL: () => ({ [sequelize_1.Op.not]: null }),
            LIKES: (value) => ({ [sequelize_1.Op.like]: `%${value}%` }),
            NOT: (value) => ({ [sequelize_1.Op.notLike]: `%${value}%` }),
            // accepted for older clients, never implemented
            MATCHES: () => undefined,
        };
        for (const key of Object.keys(filters)) {
            const filter = filters[key];
            const column = key.toLowerCase();
            const value = (_a = filter === null || filter === void 0 ? void 0 : filter.vl) !== null && _a !== void 0 ? _a : null;
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
                hidden.includes(column) ||
                (allowed && !allowed.includes(column)) ||
                !(0, lodash_1.isPlainObject)(filter) ||
                typeof filter.op != "string" ||
                !Object.prototype.hasOwnProperty.call(operators, filter.op) ||
                (value !== null &&
                    !["string", "number", "boolean"].includes(typeof value)))
                throw new errors_1.InvalidQueryError();
            const clause = operators[filter.op](value);
            if (clause !== undefined)
                model.where({ [key]: clause });
        }
        return model;
    }
}
exports.default = Query;
Query.eventPath = "/event";
