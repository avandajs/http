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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bodyParser = __importStar(require("body-parser"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const cors_1 = __importDefault(require("cors"));
const index_1 = require("../index");
const error_1 = require("@avanda/error");
const lodash_1 = require("lodash");
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
        this.path = '/';
        this.models = {};
        this.controllers = {};
        this.serverConfig = serverConfig;
        this.connection = serverConfig.connection;
        this.port = parseInt(serverConfig.port);
        this.path = serverConfig.rootPath;
        return this;
    }
    execute(models, controllers) {
        return __awaiter(this, void 0, void 0, function* () {
            this.models = models;
            this.controllers = controllers;
            this.app.use(bodyParser.json());
            this.app.use(bodyParser.urlencoded({ extended: true }));
            this.app.use((0, cors_1.default)({
                credentials: true,
                origin: (origin, callback) => {
                    if (this.serverConfig.CORSWhitelist.indexOf(origin) !== -1) {
                        callback(null, true);
                    }
                    else {
                        callback(new Error('Not allowed by CORS'));
                    }
                }
            }));
            this.app.use((0, express_fileupload_1.default)({
                useTempFiles: true
            }));
            this.app.all(this.path, (req, res) => __awaiter(this, void 0, void 0, function* () {
                let query = req.query.query;
                if (query) {
                    query = JSON.parse(query);
                    if (query) {
                        let response = yield this.generateResponse(query, req, res);
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, Origin, Authorization');
                        if (response instanceof index_1.Response) {
                            res.status(parseInt(response.status_code));
                            res.json({
                                msg: response.message,
                                data: response.data,
                                status_code: response.status_code,
                            });
                            return;
                        }
                        else {
                            res.json({
                                msg: 'Auto-generated message',
                                data: response,
                                status_code: 200,
                            });
                        }
                        return;
                    }
                }
                res.send('Hello World!');
            }));
            return this;
        });
    }
    getServerInstance() {
        return this.app;
    }
    listen() {
        if (!this.app)
            throw new error_1.runtimeError('Execute before you listen');
        this.app.listen(this.port, () => {
            console.log(`app listening at http://localhost:${this.port}`);
        });
        return this.app;
    }
    extractNeededDataFromArray(data, columns, req, res, rootService) {
        return __awaiter(this, void 0, void 0, function* () {
            let ret = [];
            if (Array.isArray(data)) {
                for (let index in data) {
                    let datum;
                    if (data[index] instanceof Object && !Array.isArray(data[index]) && data[index] !== null) {
                        if (!datum)
                            datum = {};
                        if (columns.length) {
                            for (let col of columns) {
                                if (typeof col == 'string' || (col.t && col.t == 'c')) {
                                    col = typeof col == 'string' ? col : col.n;
                                    data[index] = JSON.parse(JSON.stringify(data[index]));
                                    if (col in data[index]) {
                                        datum[col] = data[index][col];
                                    }
                                }
                                else {
                                    let service = col;
                                    col = col.a ? col.a : col.n.toLowerCase();
                                    datum[col] = yield this.generateResponse(service, req, res, false, data[index], rootService);
                                    //    await this.generateResponse(service, req, res,false)
                                    //    process the sub-service here
                                }
                            }
                        }
                        else {
                            //    return all data if no column was specified
                            datum = data[index];
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
                            datum[column] = data ? (data[column] || null) : null;
                        }
                        else {
                            datum[service.a ? service.a : service.n.toLowerCase()] = yield this.generateResponse(service, req, res, false, data, rootService);
                        }
                    }
                }
                else {
                    datum = data;
                }
                ret = datum;
            }
            return ret;
        });
    }
    generateResponse(query, req, res, isRoot = true, parentData, parentService) {
        return __awaiter(this, void 0, void 0, function* () {
            let name = query.n;
            let type = query.t;
            let children = query.c;
            if (isRoot) { //get root autolink state
                this.autoLink = query.al;
            }
            let data = null;
            let columns = [];
            if (!(name in this.controllers)) {
                throw new error_1.runtimeError('Invalid controller name: ' + name);
            }
            let controllerResponse = yield this.getServiceFncResponse(this.controllers[name], req, res, name, query, parentData, parentService);
            if (typeof controllerResponse == 'function' && !(controllerResponse instanceof index_1.Response))
                //will be function if returned from middleware decorator
                controllerResponse = yield new controllerResponse();
            //
            if (!(controllerResponse instanceof index_1.Response) && isRoot) {
                //convert raw returned data to response for the root
                controllerResponse = yield (new index_1.Response()).success('', controllerResponse);
            }
            if (isRoot && controllerResponse.status_code > 299) { //if is root, and response doesn't look success, return the root response only
                return controllerResponse;
            }
            let controllerData = controllerResponse instanceof index_1.Response ? yield controllerResponse.data : yield controllerResponse;
            if (children && controllerData) { //
                data = yield this.extractNeededDataFromArray(controllerData, children, req, res, query);
                //
            }
            if (isRoot && controllerResponse instanceof index_1.Response) {
                controllerResponse.data = data;
                return controllerResponse;
            }
            return data;
        });
    }
    getServiceFncResponse(controller, req, res, serviceName, service, parentData, parentService) {
        return __awaiter(this, void 0, void 0, function* () {
            // get Controller's specified function
            // initiate controller
            let fnc = service.f ? service.f : 'get';
            let model = null;
            let request = new index_1.Request(req, res);
            request.data = req.body;
            request.files = req.files;
            request.args = parentData;
            if (this.models && (serviceName in this.models)) {
                model = new this.models[serviceName](yield this.connection);
                if (this.autoLink && parentData) { //auto-link enabled
                    //find secondary key in parent data
                    let sec_key = (0, lodash_1.snakeCase)(parentService.n) + '_id';
                    if (typeof parentData[sec_key] != 'undefined') {
                        //    parent has 1 to 1 relationship
                        model.where({ id: parentData[sec_key] });
                    }
                    else {
                        // Parent has 1 to many relationship
                        if (typeof parentData['id'] == 'undefined') {
                            throw new error_1.runtimeError(`${parentService.n} does not return property "id" to link ${service.n}'s secondary key ${sec_key} with`);
                        }
                        model.where({ [sec_key]: parentData['id'] });
                    }
                }
                if (service.ft) {
                    //apply filters
                    model = Query.bindFilters(model, service.ft);
                }
            }
            return yield new controller(yield this.connection, model)[fnc](new index_1.Response(), request);
        });
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
                model.whereRaw(`${key} = ${value}`);
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
