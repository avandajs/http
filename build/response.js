"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Response = /** @class */ (function () {
    function Response() {
        this.statusCode = 0;
        this.perPage = 0;
    }
    Response.prototype.status = function (code) {
        this.statusCode = code;
    };
    Response.prototype.json = function (data) {
    };
    Response.prototype.success = function (msg, data, code) {
        if (data === void 0) { data = null; }
        if (code === void 0) { code = 200; }
        this.statusCode = code;
        this.data = data;
        this.message = msg;
        return this;
    };
    Response.prototype.error = function (msg, code, data) {
        if (code === void 0) { code = 401; }
        if (data === void 0) { data = null; }
        this.statusCode = 400;
        this.data = data;
        this.message = msg;
        return this;
    };
    return Response;
}());
exports.default = Response;
