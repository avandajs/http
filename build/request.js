"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Request {
    constructor(expressReq, expressRes) {
        this.method = expressReq.method;
        // this.data = expressReq.
    }
    getData(key) {
        var _a;
        return key ? (_a = this.data) === null || _a === void 0 ? void 0 : _a[key] : this.data;
    }
    getArgs(key) {
        var _a;
        return key ? (_a = this.args) === null || _a === void 0 ? void 0 : _a[key] : this.args;
    }
    getParams(key) {
        var _a;
        return key ? (_a = this.params) === null || _a === void 0 ? void 0 : _a[key] : this.params;
    }
}
exports.default = Request;
//# sourceMappingURL=request.js.map