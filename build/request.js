"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("@avanda/app");
const response_1 = __importDefault(require("./response"));
const axios_1 = __importDefault(require("axios"));
const query_1 = __importDefault(require("./graph/query"));
const lodash_1 = require("lodash");
class Request {
    constructor() {
        this.isWatcher = false;
        this.attrs = {};
        this.eventPayload = {};
        this.caches = {};
        this.headers = {};
        this.controllers = {};
        this.models = {};
        this.executeWatchable = true;
    }
    async getController(query) {
        let name = query.n;
        return new this.controllers[name](await this.connection);
    }
    setTimeOut(milliseconds) {
        this.timeout = milliseconds;
    }
    async extractNeededDataFromArray(data, columns, rootService, toExclude, _for) {
        var _a, _b, _c;
        let ret = [];
        if (Array.isArray(data)) {
            for (let index in data) {
                let datum;
                if ((0, lodash_1.isPlainObject)(data[index])) {
                    if (!datum)
                        datum = {};
                    if (columns.length) {
                        data[index] = JSON.parse(JSON.stringify(data[index]));
                        let selectAll = columns.includes("*");
                        if (selectAll) {
                            datum = (0, lodash_1.omit)(data[index], toExclude !== null && toExclude !== void 0 ? toExclude : []);
                        }
                        for (let col of columns) {
                            if (typeof col == "string" ||
                                (col.t && col.t == "c" && !selectAll)) {
                                col = typeof col == "string" ? col : col.n;
                                if ((_a = toExclude === null || toExclude === void 0 ? void 0 : toExclude.includes) === null || _a === void 0 ? void 0 : _a.call(toExclude, col.trim()))
                                    continue;
                                if (col in data[index]) {
                                    datum[col] = data[index][col];
                                }
                            }
                            else {
                                let service = col;
                                col = col.a ? col.a : (0, lodash_1.snakeCase)(col.n);
                                let cache_key = null;
                                let funcResponse = await this.generateResponseFromGraph(false, service, false, Object.assign(Object.assign({}, data[index]), datum), rootService, undefined, _for);
                                datum[col] = funcResponse;
                                // catche;
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
                let selectAll = columns.includes("*");
                if (selectAll) {
                    datum = (0, lodash_1.omit)(data, toExclude !== null && toExclude !== void 0 ? toExclude : []);
                }
                for (const service of columns) {
                    if (typeof service == "string" ||
                        (service.t && service.t === "c" && !selectAll)) {
                        let column = typeof service == "string" ? service : service.n;
                        if ((_b = toExclude === null || toExclude === void 0 ? void 0 : toExclude.includes) === null || _b === void 0 ? void 0 : _b.call(toExclude, column.trim()))
                            continue;
                        datum[column] = (_c = data[column]) !== null && _c !== void 0 ? _c : null;
                    }
                    else {
                        datum[service.a ? service.a : service.n.toLowerCase()] =
                            await this.generateResponseFromGraph(false, service, false, Object.assign(Object.assign({}, data), datum), rootService, undefined, _for);
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
    async getServiceFncResponse(controller, serviceName, service, parentData, parentService, isWatcher, wsClient) {
        // get Controller's specified function
        // initiate controller
        var _a, _b;
        let fnc = service.f ? service.f : "get";
        let model = null;
        this.method = (_a = this.expressReq.method) !== null && _a !== void 0 ? _a : "GET";
        this.data = this.expressReq.body;
        this.files = this.expressReq.files;
        this.args = parentData;
        this.parent = parentData;
        this.headers = this.expressReq.headers;
        this.params = service.pr;
        this.page = service.p;
        this.id = this.expressReq.requestId;
        this.isWatcher = isWatcher;
        let cacheResponse = true;
        // request.attrs
        let filters = {};
        let cache_key = null;
        if ((_b = this.models) === null || _b === void 0 ? void 0 : _b.hasOwnProperty(serviceName)) {
            model = new this.models[serviceName](await this.connection);
            // model.
            if (service.al) {
                let parent_key = parentService
                    ? (0, lodash_1.snakeCase)(parentService.n) + "_id"
                    : null;
                let self_key = (0, lodash_1.snakeCase)(serviceName) + "_id";
                if (parentData && parentData.hasOwnProperty(self_key)) {
                    //    parent has 1 to 1 relationship
                    if (parentData[self_key]) {
                        model.where({ id: parentData[self_key] });
                        cache_key = serviceName + "/" + fnc + "_" + "id" + "_" + parentData[self_key];
                    }
                }
                else if (parentData && typeof parentData == "object") {
                    // Parent has 1 to many relationship
                    if (typeof parentData["id"] != "undefined" && parentData["id"]) {
                        model.where({ [parent_key]: parentData["id"] });
                        cache_key =
                            serviceName +
                                "/" +
                                fnc +
                                "_" +
                                parent_key +
                                "_" +
                                parentData["id"];
                    }
                }
            }
            if (service.ft) {
                //apply filters
                model = query_1.default.bindFilters(model, service.ft);
            }
        }
        // if (cacheResponse && cache_key && this.caches.hasOwnProperty(cache_key)) {
        //   console.log("fnc from caceh>> ", { cache_key });
        //   return this.caches[cache_key];
        // }
        let response = new response_1.default();
        //set the model
        controller.model = model;
        this.model = model;
        response.model = model;
        response.wsCLient = wsClient;
        if (typeof controller[fnc] != "function")
            throw new Error(`function \`${fnc}\` does not exist in ${serviceName}`);
        let fncResponse = await controller[fnc](response, this, controller.model);
        // if (cacheResponse && cache_key) {
        //   this.caches[cache_key] = fncResponse;
        //   console.log("caching response >> ", { cache_key });
        // }
        return fncResponse;
    }
    async generateResponseFromGraph(executeWatchable = false, query = null, isRoot = true, parentData, parentService, _controller, _for = "graph", wsCLient) {
        let service = query !== null && query !== void 0 ? query : this.service;
        this.executeWatchable = executeWatchable;
        // console.log({service})
        let name = service.n;
        let type = service.t;
        let children = service.c;
        let data = null;
        if (!(name in this.controllers)) {
            throw new Error("Invalid controller name: " + name);
        }
        let controller = _controller !== null && _controller !== void 0 ? _controller : (await this.getController(service));
        let toExclude = controller === null || controller === void 0 ? void 0 : controller.exclude;
        let controllerResponse = await this.getServiceFncResponse(controller, name, service, parentData, parentService, _for === "watcher", wsCLient);
        if (typeof controllerResponse == "function" &&
            !(controllerResponse instanceof response_1.default))
            //will be function if returned from middleware decorator
            controllerResponse = await new controllerResponse();
        //
        if (!(controllerResponse instanceof response_1.default) && isRoot) {
            //convert raw returned data to response for the root
            controllerResponse = await new response_1.default().success("", controllerResponse);
        }
        if (isRoot && controllerResponse.status_code > 299) {
            //if is root, and response doesn't look success, return the root response only
            this.executeWatchable = true;
            return controllerResponse;
        }
        // // Stop deep nesting if response didn't change
        // if (controllerResponse instanceof Response && _for == 'watcher' && !controllerResponse.responseChanged && isRoot){
        //     return  controllerResponse;
        // }
        let controllerData = controllerResponse instanceof response_1.default
            ? await controllerResponse.data
            : await controllerResponse;
        if (children && controllerData) {
            //
            data = await this.extractNeededDataFromArray(JSON.parse(JSON.stringify(controllerData, null, 2)), children, service, toExclude, _for);
            //
        }
        if (isRoot && controllerResponse instanceof response_1.default) {
            controllerResponse.data = data;
            this.executeWatchable = true;
            return controllerResponse;
        }
        this.executeWatchable = true;
        return data;
    }
    getFiles(key) {
        var _a;
        let files = (_a = this.files) === null || _a === void 0 ? void 0 : _a[key];
        if (!Array.isArray(files))
            return [files];
        return files;
    }
    getFile(key) {
        var _a;
        let files = (_a = this.files) === null || _a === void 0 ? void 0 : _a[key];
        if (Array.isArray(files))
            return files[0];
        else
            return files;
    }
    getData(key) {
        var _a, _b;
        return key ? (_b = (_a = this.data) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null : null;
    }
    getObjectData(key) {
        var _a;
        return key ? JSON.parse((_a = this.data) === null || _a === void 0 ? void 0 : _a[key]) : null;
    }
    setData(data) {
        this.data = data;
        return this;
    }
    setHeaders(headers) {
        this.headers = headers;
        return this;
    }
    setQuery(query) {
        this.query = query;
        return this;
    }
    setAttr(attr, value) {
        this.attrs[attr] = value;
        return this;
    }
    setAttrs(attrs) {
        this.attrs = attrs;
        return this;
    }
    setPayload(payload) {
        this.eventPayload = payload;
        return this;
    }
    getPayload() {
        return this.eventPayload;
    }
    getHeader(key) {
        var _a, _b;
        return key ? (_b = (_a = this.headers) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null : null;
    }
    getArgs(key) {
        var _a, _b;
        return key ? (_b = (_a = this.args) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null : null;
    }
    getAttrs(key) {
        var _a, _b;
        return key ? (_b = (_a = this.attrs) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null : null;
    }
    getParams(key) {
        var _a, _b;
        return key ? (_b = (_a = this.params) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null : null;
    }
    async validate(schemaRules) {
        let schema = new app_1.Validator.Schema(schemaRules(app_1.Validator.Rule));
        let result = await schema.validate(this.data);
        if (Object.keys(result).length > 0) {
            return new response_1.default().error("Invalid input", 400, result);
        }
        return true;
    }
    async get(url) {
        return await this.makeRequest(url, async (url) => await axios_1.default.get(url, {
            headers: this.headers,
            timeout: this.timeout
        }));
    }
    async post(url, data) {
        return await this.makeRequest(url, async (url) => {
            var _a;
            return await axios_1.default.post(url, (_a = data !== null && data !== void 0 ? data : this.data) !== null && _a !== void 0 ? _a : {}, {
                headers: this.headers,
                timeout: this.timeout
            });
        });
    }
    async patch(url, data) {
        return await this.makeRequest(url, async (url) => {
            var _a;
            return await axios_1.default.patch(url, (_a = data !== null && data !== void 0 ? data : this.data) !== null && _a !== void 0 ? _a : {}, {
                headers: this.headers,
                timeout: this.timeout
            });
        });
    }
    async put(url, data) {
        return await this.makeRequest(url, async (url) => {
            var _a;
            return await axios_1.default.put(url, (_a = data !== null && data !== void 0 ? data : this.data) !== null && _a !== void 0 ? _a : {}, {
                headers: this.headers,
                timeout: this.timeout
            });
        });
    }
    async makeRequest(url, request) {
        try {
            let queryString = this.query
                ? new URLSearchParams(this.query).toString()
                : "";
            if (queryString.length)
                url += "?" + queryString;
            let axiosRes = await request(url);
            let status = axiosRes.status;
            let headers = axiosRes.headers;
            let response = new response_1.default();
            response.headers = headers;
            response.statusCode = status;
            response.data = axiosRes.data;
            return response;
        }
        catch (e) {
            let response = new response_1.default();
            response.headers = e.response.headers;
            response.statusCode = e.response.status;
            response.data = e.response.data;
            response.message = e.response.statusText;
            return response;
        }
    }
}
exports.default = Request;
