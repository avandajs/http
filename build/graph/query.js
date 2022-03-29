"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
const lodash_1 = require("lodash");
const ws_1 = __importDefault(require("ws"));
const query_string_1 = __importDefault(require("query-string"));
const uuid_1 = require("uuid");
const ip_1 = __importDefault(require("ip"));
const package_json_1 = require("../package.json");
const cli_1 = require("@avanda/cli");
let CLIENTS = [];
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
        this.watcherLatency = 3000;
        this.httpPath = '/graph';
        this.websocketPath = '/watch';
        this.corsRejected = true;
        this.models = {};
        this.controllers = {};
        this.serverConfig = serverConfig;
        this.connection = serverConfig.connection;
        this.port = parseInt(serverConfig.port);
        this.httpPath = serverConfig.rootPath;
        return this;
    }
    static responseToObject(response) {
        if (response instanceof index_1.Response) {
            return Object.assign({ msg: response.message, data: response.data, status_code: response.statusCode, current_page: response.currentPage, per_page: response.perPage }, (response.totalPages && { total_pages: response.totalPages }));
        }
        else {
            return Object.assign({ msg: 'Auto-generated message', data: response, status_code: 200, current_page: response.currentPage, per_page: response.perPage }, (response.totalPages && { totalPages: response.totalPages }));
        }
    }
    execute(models, controllers) {
        this.models = models;
        this.controllers = controllers;
        this.app.use(bodyParser.json({ limit: '100mb' }));
        this.app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
        this.app.use((0, cors_1.default)({
            credentials: true,
            origin: (origin, callback) => {
                if (!origin || this.serverConfig.CORSWhitelist.indexOf(origin) !== -1) {
                    this.corsRejected = false;
                    callback(null, true);
                }
                else {
                    this.corsRejected = true;
                    callback(null, true);
                }
            }
        }));
        this.app.use((0, express_fileupload_1.default)({
            useTempFiles: true
        }));
        this.app.use(express_1.default.static('public'));
        // this.app.request
        this.app.all(this.httpPath, async (req, res) => {
            let query = req.query.query;
            if (this.corsRejected) {
                res.json({
                    msg: null,
                    data: null,
                    status_code: 500,
                    total_pages: 0
                });
                return;
            }
            else if (query) {
                query = JSON.parse(query);
                if (query) {
                    let response = await this.generateResponse(query, req, res);
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, Origin, Authorization');
                    if (response.statusCode) {
                        res.status(parseInt(response.statusCode));
                    }
                    res.json(Query.responseToObject(response));
                    return;
                }
            }
            res.send('Hello World!');
        });
        //websocket watch
        this.app.all(this.websocketPath);
        this.server = http.createServer(this.app);
        // this.app.
        // this.server.
        this.startWebSocket(this.server, this.websocketPath);
        return this;
    }
    getServerInstance(req, res) {
        // this.app()
        return this.server;
    }
    async sendResponseToClient(client) {
        let res = await this.generateResponse(client.service, client.req, client.res);
        // console.log({res})
        if (res === null || res === void 0 ? void 0 : res.responseChanged) {
            client.client.send(JSON.stringify(Query.responseToObject(res)));
        }
    }
    async startWatchingFunctions() {
        for (let index in CLIENTS) {
            this.sendResponseToClient(CLIENTS[index]);
        }
    }
    handleConnectionAbortion(websocketConnection) {
        CLIENTS = CLIENTS.filter(client => client.client.clientId != websocketConnection.clientId);
        console.log("disconnected client: " + websocketConnection.clientId);
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
            request.body = connectionParams.data ? JSON.parse(connectionParams.data) : undefined;
            request.headers = connectionRequest.headers;
            request.statusCode = connectionRequest.statusCode;
            request.statusMessage = connectionRequest.statusMessage;
            request.requestId = clientId;
            const service = JSON.parse(connectionParams.query);
            websocketConnection.clientId = clientId; //
            websocketConnection.clientIndex = CLIENTS.length; //
            websocketConnection.service = service; //
            CLIENTS.push({
                client: websocketConnection,
                id: websocketConnection.clientId,
                service: service,
                req: request,
                res: response
            });
            // websocketConnection.
            console.log(">> new connection", { clientId });
            // NOTE: connectParams are not used here but good to understand how to get
            // to them if you need to pass data with the connection to identify it (e.g., a userId).
            websocketConnection.on("message", async (message) => {
                console.log(">>>New message to: " + websocketConnection.clientId + ">>>> " + message);
                request.body = message ? JSON.parse(message) : {};
                let res = await this.generateResponse(websocketConnection.service, request, response);
                // console.log({request})
                let obj = Query.responseToObject(res);
                websocketConnection.send(JSON.stringify(obj));
            });
            websocketConnection.on("close", (client) => {
                this.handleConnectionAbortion(websocketConnection);
            });
            websocketConnection.on("end", (client) => {
                this.handleConnectionAbortion(websocketConnection);
            });
            websocketConnection.on("aborted", (client) => {
                this.handleConnectionAbortion(websocketConnection);
            });
            setInterval(() => {
                this.startWatchingFunctions();
            }, this.watcherLatency);
        });
        return websocketServer;
    }
    listen() {
        if (!this.app)
            throw new Error('Execute before you listen');
        let ipAddress = ip_1.default.address("public");
        // network.
        this.server.listen(this.port, () => {
            cli_1.Out.success(`@avanda/http v${package_json_1.version} dev server running at:`, false);
            console.log(`
> Local:    http://localhost:${this.port}/
> Network:  http://${ipAddress}:${this.port}/`);
        });
        return this.server;
    }
    async extractNeededDataFromArray(data, columns, req, res, rootService, toExclude) {
        var _a, _b, _c;
        let ret = [];
        if (Array.isArray(data)) {
            for (let index in data) {
                let datum;
                if ((0, lodash_1.isPlainObject)(data[index])) {
                    if (!datum)
                        datum = {};
                    if (columns.length) {
                        for (let col of columns) {
                            if (typeof col == 'string' || (col.t && col.t == 'c')) {
                                col = typeof col == 'string' ? col : col.n;
                                //
                                if ((_a = toExclude === null || toExclude === void 0 ? void 0 : toExclude.includes) === null || _a === void 0 ? void 0 : _a.call(toExclude, col.trim()))
                                    continue;
                                // if (this)
                                data[index] = JSON.parse(JSON.stringify(data[index]));
                                if (col in data[index]) {
                                    datum[col] = data[index][col];
                                }
                            }
                            else {
                                let service = col;
                                col = col.a ? col.a : col.n.toLowerCase();
                                datum[col] = await this.generateResponse(service, req, res, false, data[index], rootService);
                                //    await this.generateResponse(service, req, res,false)
                                //    process the sub-service here
                            }
                        }
                    }
                    else {
                        //    return all data if no column was specified
                        datum = (0, lodash_1.omit)(data[index], toExclude !== null && toExclude !== void 0 ? toExclude : []);
                    }
                }
                else {
                    //    item in this array is not object
                    datum = data[index];
                }
                ret.push(datum);
            }
        }
        else {
            let datum = {};
            if (columns.length) {
                for (const service of columns) {
                    if (typeof service == 'string' || (service.t && service.t === 'c')) {
                        let column = typeof service == 'string' ? service : service.n;
                        if ((_b = toExclude === null || toExclude === void 0 ? void 0 : toExclude.includes) === null || _b === void 0 ? void 0 : _b.call(toExclude, column.trim()))
                            continue;
                        datum[column] = (_c = data[column]) !== null && _c !== void 0 ? _c : null;
                    }
                    else {
                        datum[service.a ? service.a : service.n.toLowerCase()] = await this.generateResponse(service, req, res, false, data, rootService);
                    }
                }
            }
            else {
                if ((0, lodash_1.isPlainObject)(data))
                    datum = (0, lodash_1.omit)(data, toExclude !== null && toExclude !== void 0 ? toExclude : []);
                else
                    datum = data;
            }
            ret = datum;
        }
        return ret;
    }
    async getController(query) {
        let name = query.n;
        return new this.controllers[name](await this.connection);
    }
    async generateResponse(query, req, res, isRoot = true, parentData, parentService, _controller) {
        let name = query.n;
        let type = query.t;
        let children = query.c;
        if (isRoot) { //get root autolink state
            this.autoLink = query.al;
        }
        let data = null;
        if (!(name in this.controllers)) {
            throw new Error('Invalid controller name: ' + name);
        }
        let controller = _controller !== null && _controller !== void 0 ? _controller : await this.getController(query);
        let toExclude = controller === null || controller === void 0 ? void 0 : controller.exclude;
        let controllerResponse = await this.getServiceFncResponse(controller, req, res, name, query, parentData, parentService);
        if (typeof controllerResponse == 'function' && !(controllerResponse instanceof index_1.Response))
            //will be function if returned from middleware decorator
            controllerResponse = await new controllerResponse();
        //
        if (!(controllerResponse instanceof index_1.Response) && isRoot) {
            //convert raw returned data to response for the root
            controllerResponse = await (new index_1.Response()).success('', controllerResponse);
        }
        if (isRoot && controllerResponse.status_code > 299) { //if is root, and response doesn't look success, return the root response only
            return controllerResponse;
        }
        let controllerData = controllerResponse instanceof index_1.Response ? await controllerResponse.data : await controllerResponse;
        if (children && controllerData) { //
            data = await this.extractNeededDataFromArray(JSON.parse(JSON.stringify(controllerData, null, 2)), children, req, res, query, toExclude);
            //
        }
        if (isRoot && controllerResponse instanceof index_1.Response) {
            controllerResponse.data = data;
            return controllerResponse;
        }
        return data;
    }
    async getServiceFncResponse(controller, req, res, serviceName, service, parentData, parentService) {
        // get Controller's specified function
        // initiate controller
        let fnc = service.f ? service.f : 'get';
        let model = null;
        let request = new index_1.Request();
        request.method = req.method;
        request.data = req.body;
        request.files = req.files;
        request.args = parentData;
        request.headers = req.headers;
        request.params = service.pr;
        request.page = service.p;
        request.id = req.requestId;
        let filters = {};
        if (this.models && (serviceName in this.models)) {
            model = new this.models[serviceName](await this.connection);
            if (this.autoLink && parentData) { //auto-link enabled
                //find secondary key in parent data
                let parent_key = (0, lodash_1.snakeCase)(parentService.n) + '_id';
                let self_key = (0, lodash_1.snakeCase)(serviceName) + '_id';
                if (typeof parentData[self_key] != 'undefined') {
                    //    parent has 1 to 1 relationship
                    model.where({ id: parentData[self_key] });
                }
                else {
                    // Parent has 1 to many relationship
                    if (typeof parentData['id'] == 'undefined') {
                        throw new Error(`${parentService.n} does not return property "id" to link ${service.n}'s secondary key ${parent_key} with`);
                    }
                    model.where({ [parent_key]: parentData['id'] });
                }
            }
            if (service.ft) {
                //apply filters
                model = Query.bindFilters(model, service.ft);
            }
        }
        //set the model
        controller.model = model;
        if (typeof controller[fnc] != 'function')
            throw new Error(`function \`${fnc}\` does not exist in ${serviceName}`);
        return await controller[fnc](new index_1.Response(), request);
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
                operators['=='](key, value, model);
            },
            "!=": (key, value, model) => {
                model.whereRaw(`${key} != ${value}`);
            },
            "NULL": (key, value, model) => {
                model.whereColIsNull(key);
            },
            "NOTNULL": (key, value, model) => {
                model.whereColIsNotNull(key);
            },
            "MATCHES": (key, value, model) => {
                model.whereColumns(key).matches(value);
            },
            "LIKES": (key, value, model) => {
                model.where(key).like(`%${value}%`);
            },
            "NOT": (key, value, model) => {
                model.where(key).notLike("%$value%");
            }
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
exports.default = Query;
