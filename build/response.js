"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = __importDefault(require("./graph/query"));
class Response {
    constructor() {
        this.statusCode = 0;
        this.responseChanged = false;
        this.isMiddlewareRes = false;
        this.perPage = 0;
    }
    status(code) {
        this.statusCode = code;
    }
    json(data) { }
    success(msg, data = null, code = 200) {
        this.statusCode = code;
        this.data = data;
        this.message = msg;
        return this;
    }
    redirect(url) {
        this.statusCode = 302;
        this.redirectTo = url;
        return this;
    }
    sendResponseAsWsMessage(response) {
        if (this.wsCLient)
            this.wsCLient.send(JSON.stringify(query_1.default.responseToObject(response)));
        return this;
    }
    error(msg, code = 401, data = null) {
        this.statusCode = 400;
        this.data = data;
        this.message = msg;
        return this;
    }
    async pagedData(request, msg) {
        let data = await request.model.page(request.page, true);
        //@ts-ignore
        this.totalPages = request.model.totalPages;
        this.currentPage = request.page;
        // @ts-ignore
        this.perPage = request.model.perPage;
        return this.success(msg !== null && msg !== void 0 ? msg : "Data fetched", data);
    }
    async singleData() {
        var _a;
        return await ((_a = this.model) === null || _a === void 0 ? void 0 : _a.first());
    }
    async allData() {
        var _a;
        return await ((_a = this.model) === null || _a === void 0 ? void 0 : _a.all());
    }
}
exports.default = Response;
