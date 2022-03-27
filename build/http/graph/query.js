"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var bodyParser = __importStar(require("body-parser"));
var express_fileupload_1 = __importDefault(require("express-fileupload"));
var cors_1 = __importDefault(require("cors"));
var http = __importStar(require("http"));
var index_1 = require("../index");
var lodash_1 = require("lodash");
var ws_1 = __importDefault(require("ws"));
var query_string_1 = __importDefault(require("query-string"));
var CLIENTS = [];
/*
 *
 * The keys in the json/Service objects
 * are kept single letter to
 * make request URL as
 * short as possible
 *
 * */
var Query = /** @class */ (function () {
    function Query(serverConfig) {
        this.app = (0, express_1.default)();
        this.port = 8080;
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
    Query.responseToObject = function (response) {
        if (response instanceof index_1.Response) {
            return __assign({ msg: response.message, data: response.data, status_code: response.statusCode, current_page: response.currentPage, per_page: response.perPage }, (response.totalPages && { total_pages: response.totalPages }));
        }
        else {
            return __assign({ msg: 'Auto-generated message', data: response, status_code: 200, current_page: response.currentPage, per_page: response.perPage }, (response.totalPages && { totalPages: response.totalPages }));
        }
    };
    Query.prototype.execute = function (models, controllers) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.models = models;
                this.controllers = controllers;
                this.app.use(bodyParser.json({ limit: '100mb' }));
                this.app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
                this.app.use((0, cors_1.default)({
                    credentials: true,
                    origin: function (origin, callback) {
                        if (!origin || _this.serverConfig.CORSWhitelist.indexOf(origin) !== -1) {
                            _this.corsRejected = false;
                            callback(null, true);
                        }
                        else {
                            _this.corsRejected = true;
                            callback(null, true);
                        }
                    }
                }));
                this.app.use((0, express_fileupload_1.default)({
                    useTempFiles: true
                }));
                this.app.use(express_1.default.static('public'));
                // this.app.request
                this.app.all(this.httpPath, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                    var query, response_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                query = req.query.query;
                                if (!this.corsRejected) return [3 /*break*/, 1];
                                res.json({
                                    msg: null,
                                    data: null,
                                    status_code: 500,
                                    total_pages: 0
                                });
                                return [2 /*return*/];
                            case 1:
                                if (!query) return [3 /*break*/, 3];
                                query = JSON.parse(query);
                                if (!query) return [3 /*break*/, 3];
                                return [4 /*yield*/, this.generateResponse(query, req, res)];
                            case 2:
                                response_1 = _a.sent();
                                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, Origin, Authorization');
                                if (response_1.statusCode) {
                                    res.status(parseInt(response_1.statusCode));
                                }
                                res.json(Query.responseToObject(response_1));
                                return [2 /*return*/];
                            case 3:
                                res.send('Hello World!');
                                return [2 /*return*/];
                        }
                    });
                }); });
                //websocket watch
                this.app.all(this.websocketPath);
                this.server = http.createServer(this.app);
                this.startWebSocket(this.server, this.websocketPath);
                return [2 /*return*/, this];
            });
        });
    };
    Query.prototype.getServerInstance = function () {
        return this.server;
    };
    Query.prototype.sendResponseToClient = function (client) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.generateResponse(client.service, client.req, client.res)
                        // console.log({res})
                    ];
                    case 1:
                        res = _a.sent();
                        // console.log({res})
                        if (res === null || res === void 0 ? void 0 : res.responseChanged) {
                            client.client.send(JSON.stringify(Query.responseToObject(res)));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    Query.prototype.startWatchingFunctions = function () {
        for (var index in CLIENTS) {
            this.sendResponseToClient(CLIENTS[index]);
        }
    };
    Query.prototype.startWebSocket = function (express, path) {
        //
        var _this = this;
        var websocketServer = new ws_1.default.Server({
            noServer: true,
            path: path,
        });
        express.on("upgrade", function (request, socket, head) {
            websocketServer.handleUpgrade(request, socket, head, function (websocket) {
                websocketServer.emit("connection", websocket, request);
            });
        });
        var request = this.app.request;
        var response = this.app.response;
        websocketServer.on("connection", function (websocketConnection, connectionRequest) {
            var _a;
            var _b = (_a = connectionRequest === null || connectionRequest === void 0 ? void 0 : connectionRequest.url) === null || _a === void 0 ? void 0 : _a.split("?"), _path = _b[0], params = _b[1];
            var connectionParams = query_string_1.default.parse(params);
            request.body = JSON.parse(connectionParams.data);
            request.headers = connectionRequest.headers;
            request.statusCode = connectionRequest.statusCode;
            request.statusMessage = connectionRequest.statusMessage;
            CLIENTS.push({
                client: websocketConnection,
                id: CLIENTS.length,
                service: JSON.parse(connectionParams.query),
                req: request,
                res: response
            });
            // connectionRequest.
            console.log({ CLIENTS: CLIENTS });
            // websocketConnection.
            console.log(">> new connection");
            // NOTE: connectParams are not used here but good to understand how to get
            // to them if you need to pass data with the connection to identify it (e.g., a userId).
            websocketConnection.on("message", function (message) {
                var parsedMessage = JSON.parse(message);
                websocketConnection.send(JSON.stringify({ message: 'There be gold in them thar hills.' }));
            });
            setInterval(function () {
                _this.startWatchingFunctions();
            }, 1000);
        });
        return websocketServer;
    };
    Query.prototype.listen = function () {
        var _this = this;
        if (!this.app)
            throw new Error('Execute before you listen');
        this.server.listen(this.port, function () {
            console.log("app listening at http://localhost:" + _this.port);
        });
        return this.server;
    };
    Query.prototype.extractNeededDataFromArray = function (data, columns, req, res, rootService, toExclude) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function () {
            var ret, _d, _e, _i, index, datum, _f, columns_1, col, service, _g, _h, datum, _j, columns_2, service, column, _k, _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        ret = [];
                        if (!Array.isArray(data)) return [3 /*break*/, 13];
                        _d = [];
                        for (_e in data)
                            _d.push(_e);
                        _i = 0;
                        _m.label = 1;
                    case 1:
                        if (!(_i < _d.length)) return [3 /*break*/, 12];
                        index = _d[_i];
                        datum = void 0;
                        if (!(0, lodash_1.isPlainObject)(data[index])) return [3 /*break*/, 9];
                        if (!datum)
                            datum = {};
                        if (!columns.length) return [3 /*break*/, 7];
                        _f = 0, columns_1 = columns;
                        _m.label = 2;
                    case 2:
                        if (!(_f < columns_1.length)) return [3 /*break*/, 6];
                        col = columns_1[_f];
                        if (!(typeof col == 'string' || (col.t && col.t == 'c'))) return [3 /*break*/, 3];
                        col = typeof col == 'string' ? col : col.n;
                        //
                        if ((_a = toExclude === null || toExclude === void 0 ? void 0 : toExclude.includes) === null || _a === void 0 ? void 0 : _a.call(toExclude, col.trim()))
                            return [3 /*break*/, 5];
                        // if (this)
                        data[index] = JSON.parse(JSON.stringify(data[index]));
                        if (col in data[index]) {
                            datum[col] = data[index][col];
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        service = col;
                        col = col.a ? col.a : col.n.toLowerCase();
                        _g = datum;
                        _h = col;
                        return [4 /*yield*/, this.generateResponse(service, req, res, false, data[index], rootService)
                            //    await this.generateResponse(service, req, res,false)
                            //    process the sub-service here
                        ];
                    case 4:
                        _g[_h] = _m.sent();
                        _m.label = 5;
                    case 5:
                        _f++;
                        return [3 /*break*/, 2];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        //    return all data if no column was specified
                        datum = (0, lodash_1.omit)(data[index], toExclude !== null && toExclude !== void 0 ? toExclude : []);
                        _m.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        //    item in this array is not object
                        datum = data[index];
                        _m.label = 10;
                    case 10:
                        ret.push(datum);
                        _m.label = 11;
                    case 11:
                        _i++;
                        return [3 /*break*/, 1];
                    case 12: return [3 /*break*/, 21];
                    case 13:
                        datum = {};
                        if (!columns.length) return [3 /*break*/, 19];
                        _j = 0, columns_2 = columns;
                        _m.label = 14;
                    case 14:
                        if (!(_j < columns_2.length)) return [3 /*break*/, 18];
                        service = columns_2[_j];
                        if (!(typeof service == 'string' || (service.t && service.t === 'c'))) return [3 /*break*/, 15];
                        column = typeof service == 'string' ? service : service.n;
                        if ((_b = toExclude === null || toExclude === void 0 ? void 0 : toExclude.includes) === null || _b === void 0 ? void 0 : _b.call(toExclude, column.trim()))
                            return [3 /*break*/, 17];
                        datum[column] = (_c = data[column]) !== null && _c !== void 0 ? _c : null;
                        return [3 /*break*/, 17];
                    case 15:
                        _k = datum;
                        _l = service.a ? service.a : service.n.toLowerCase();
                        return [4 /*yield*/, this.generateResponse(service, req, res, false, data, rootService)];
                    case 16:
                        _k[_l] = _m.sent();
                        _m.label = 17;
                    case 17:
                        _j++;
                        return [3 /*break*/, 14];
                    case 18: return [3 /*break*/, 20];
                    case 19:
                        if ((0, lodash_1.isPlainObject)(data))
                            datum = (0, lodash_1.omit)(data, toExclude !== null && toExclude !== void 0 ? toExclude : []);
                        else
                            datum = data;
                        _m.label = 20;
                    case 20:
                        ret = datum;
                        _m.label = 21;
                    case 21: return [2 /*return*/, ret];
                }
            });
        });
    };
    Query.prototype.generateResponse = function (query, req, res, isRoot, parentData, parentService) {
        if (isRoot === void 0) { isRoot = true; }
        return __awaiter(this, void 0, void 0, function () {
            var name, type, children, data, controller, _a, _b, toExclude, controllerResponse, controllerData, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        name = query.n;
                        type = query.t;
                        children = query.c;
                        if (isRoot) { //get root autolink state
                            this.autoLink = query.al;
                        }
                        data = null;
                        if (!(name in this.controllers)) {
                            throw new Error('Invalid controller name: ' + name);
                        }
                        _b = (_a = this.controllers[name]).bind;
                        return [4 /*yield*/, this.connection];
                    case 1:
                        controller = new (_b.apply(_a, [void 0, _d.sent()]))();
                        toExclude = controller === null || controller === void 0 ? void 0 : controller.exclude;
                        return [4 /*yield*/, this.getServiceFncResponse(controller, req, res, name, query, parentData, parentService)];
                    case 2:
                        controllerResponse = _d.sent();
                        if (!(typeof controllerResponse == 'function' && !(controllerResponse instanceof index_1.Response))) return [3 /*break*/, 4];
                        return [4 /*yield*/, new controllerResponse()
                            //
                        ];
                    case 3:
                        //will be function if returned from middleware decorator
                        controllerResponse = _d.sent();
                        _d.label = 4;
                    case 4:
                        if (!(!(controllerResponse instanceof index_1.Response) && isRoot)) return [3 /*break*/, 6];
                        return [4 /*yield*/, (new index_1.Response()).success('', controllerResponse)];
                    case 5:
                        //convert raw returned data to response for the root
                        controllerResponse = _d.sent();
                        _d.label = 6;
                    case 6:
                        if (isRoot && controllerResponse.status_code > 299) { //if is root, and response doesn't look success, return the root response only
                            return [2 /*return*/, controllerResponse];
                        }
                        if (!(controllerResponse instanceof index_1.Response)) return [3 /*break*/, 8];
                        return [4 /*yield*/, controllerResponse.data];
                    case 7:
                        _c = _d.sent();
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, controllerResponse];
                    case 9:
                        _c = _d.sent();
                        _d.label = 10;
                    case 10:
                        controllerData = _c;
                        if (!(children && controllerData)) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.extractNeededDataFromArray(JSON.parse(JSON.stringify(controllerData, null, 2)), children, req, res, query, toExclude)];
                    case 11:
                        data = _d.sent();
                        _d.label = 12;
                    case 12:
                        if (isRoot && controllerResponse instanceof index_1.Response) {
                            controllerResponse.data = data;
                            return [2 /*return*/, controllerResponse];
                        }
                        return [2 /*return*/, data];
                }
            });
        });
    };
    Query.prototype.getServiceFncResponse = function (controller, req, res, serviceName, service, parentData, parentService) {
        return __awaiter(this, void 0, void 0, function () {
            var fnc, model, request, filters, _a, _b, parent_key, self_key;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        fnc = service.f ? service.f : 'get';
                        model = null;
                        request = new index_1.Request();
                        request.method = req.method;
                        request.data = req.body;
                        request.files = req.files;
                        request.args = parentData;
                        request.headers = req.headers;
                        request.params = service.pr;
                        request.page = service.p;
                        filters = {};
                        if (!(this.models && (serviceName in this.models))) return [3 /*break*/, 2];
                        _b = (_a = this.models[serviceName]).bind;
                        return [4 /*yield*/, this.connection];
                    case 1:
                        model = new (_b.apply(_a, [void 0, _d.sent()]))();
                        if (this.autoLink && parentData) { //auto-link enabled
                            parent_key = (0, lodash_1.snakeCase)(parentService.n) + '_id';
                            self_key = (0, lodash_1.snakeCase)(serviceName) + '_id';
                            if (typeof parentData[self_key] != 'undefined') {
                                //    parent has 1 to 1 relationship
                                model.where({ id: parentData[self_key] });
                            }
                            else {
                                // Parent has 1 to many relationship
                                if (typeof parentData['id'] == 'undefined') {
                                    throw new Error(parentService.n + " does not return property \"id\" to link " + service.n + "'s secondary key " + parent_key + " with");
                                }
                                model.where((_c = {}, _c[parent_key] = parentData['id'], _c));
                            }
                        }
                        if (service.ft) {
                            //apply filters
                            model = Query.bindFilters(model, service.ft);
                        }
                        _d.label = 2;
                    case 2:
                        //set the model
                        controller.model = model;
                        if (typeof controller[fnc] != 'function')
                            throw new Error("function `" + fnc + "` does not exist in " + serviceName);
                        return [4 /*yield*/, controller[fnc](new index_1.Response(), request)];
                    case 3: return [2 /*return*/, _d.sent()];
                }
            });
        });
    };
    Query.bindFilters = function (model, filters) {
        var _a;
        var operators;
        operators = {
            ">": function (key, value, model) {
                model.whereRaw(key + " > " + value);
            },
            "<": function (key, value, model) {
                model.whereRaw(key + " < " + value);
            },
            "==": function (key, value, model) {
                var _a;
                model.where((_a = {}, _a[key] = value, _a));
            },
            "=": function (key, value, model) {
                operators['=='](key, value, model);
            },
            "!=": function (key, value, model) {
                model.whereRaw(key + " != " + value);
            },
            "NULL": function (key, value, model) {
                model.whereColIsNull(key);
            },
            "NOTNULL": function (key, value, model) {
                model.whereColIsNotNull(key);
            },
            "MATCHES": function (key, value, model) {
                model.whereColumns(key).matches(value);
            },
            "LIKES": function (key, value, model) {
                model.where(key).like("%" + value + "%");
            },
            "NOT": function (key, value, model) {
                model.where(key).notLike("%$value%");
            }
        };
        for (var key in filters) {
            var filter = filters[key];
            var value = (_a = filter.vl) !== null && _a !== void 0 ? _a : null;
            var operator = filter.op;
            operators[operator](key, value, model);
        }
        return model;
    };
    return Query;
}());
exports.default = Query;
