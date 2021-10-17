"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("@avanda/app");
const response_1 = __importDefault(require("./response"));
class Request {
    constructor(expressReq, expressRes) {
        this.method = expressReq.method;
        // this.data = expressReq.
    }
    getFiles(key) {
        var _a;
        return (_a = this.files) === null || _a === void 0 ? void 0 : _a[key];
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
    validate(schemaRules) {
        let schema = (new app_1.Schema(schemaRules)).validate(this.data);
        if (Object.keys(schema).length > 0) {
            return (new response_1.default()).error('Invalid input', 400, schema);
        }
        return true;
    }
}
exports.default = Request;
