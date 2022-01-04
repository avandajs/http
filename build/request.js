"use strict";
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
var app_1 = require("@avanda/app");
var response_1 = __importDefault(require("./response"));
var axios_1 = __importDefault(require("axios"));
var Request = /** @class */ (function () {
    function Request() {
        this.attrs = {};
    }
    Request.prototype.getFiles = function (key) {
        var _a;
        var files = (_a = this.files) === null || _a === void 0 ? void 0 : _a[key];
        if (!Array.isArray(files))
            return [files];
        return files;
    };
    Request.prototype.getFile = function (key) {
        var _a;
        console.log({ files: this.files });
        var files = (_a = this.files) === null || _a === void 0 ? void 0 : _a[key];
        if (Array.isArray(files))
            return files[0];
        else
            return files;
    };
    Request.prototype.getData = function (key) {
        var _a, _b;
        return key ? ((_b = (_a = this.data) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null) : null;
    };
    Request.prototype.setData = function (data) {
        this.data = data;
        return this;
    };
    Request.prototype.setHeaders = function (headers) {
        this.headers = headers;
        return this;
    };
    Request.prototype.setQuery = function (query) {
        this.query = query;
        return this;
    };
    Request.prototype.setAttr = function (attr, value) {
        this.attrs[attr] = value;
        return this;
    };
    Request.prototype.setAttrs = function (attrs) {
        this.attrs = attrs;
        return this;
    };
    Request.prototype.getHeader = function (key) {
        var _a, _b;
        return key ? ((_b = (_a = this.headers) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null) : null;
    };
    Request.prototype.getArgs = function (key) {
        var _a, _b;
        return key ? ((_b = (_a = this.args) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null) : null;
    };
    Request.prototype.getAttrs = function (key) {
        var _a, _b;
        return key ? ((_b = (_a = this.attrs) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null) : null;
    };
    Request.prototype.getParams = function (key) {
        var _a, _b;
        return key ? ((_b = (_a = this.params) === null || _a === void 0 ? void 0 : _a[key]) !== null && _b !== void 0 ? _b : null) : null;
    };
    Request.prototype.validate = function (schemaRules) {
        return __awaiter(this, void 0, void 0, function () {
            var schema, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        schema = (new app_1.Validator.Schema(schemaRules(app_1.Validator.Rule)));
                        return [4 /*yield*/, schema.validate(this.data)];
                    case 1:
                        result = _a.sent();
                        if (Object.keys(result).length > 0) {
                            return [2 /*return*/, (new response_1.default()).error('Invalid input', 400, result)];
                        }
                        return [2 /*return*/, true];
                }
            });
        });
    };
    Request.prototype.get = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(url, function (url) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, axios_1.default.get(url, {
                                            headers: this.headers
                                        })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Request.prototype.post = function (url, data) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(url, function (url) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, axios_1.default.post(url, (_a = data !== null && data !== void 0 ? data : this.data) !== null && _a !== void 0 ? _a : {}, {
                                            headers: this.headers
                                        })];
                                    case 1: return [2 /*return*/, _b.sent()];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Request.prototype.patch = function (url, data) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(url, function (url) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, axios_1.default.patch(url, (_a = data !== null && data !== void 0 ? data : this.data) !== null && _a !== void 0 ? _a : {}, {
                                            headers: this.headers
                                        })];
                                    case 1: return [2 /*return*/, _b.sent()];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Request.prototype.put = function (url, data) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeRequest(url, function (url) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, axios_1.default.put(url, (_a = data !== null && data !== void 0 ? data : this.data) !== null && _a !== void 0 ? _a : {}, {
                                            headers: this.headers
                                        })];
                                    case 1: return [2 /*return*/, _b.sent()];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Request.prototype.makeRequest = function (url, request) {
        return __awaiter(this, void 0, void 0, function () {
            var queryString, axiosRes, status_1, headers, response, e_1, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        queryString = this.query ? new URLSearchParams(this.query).toString() : '';
                        if (queryString.length)
                            url += '?' + queryString;
                        return [4 /*yield*/, request(url)];
                    case 1:
                        axiosRes = _a.sent();
                        status_1 = axiosRes.status;
                        headers = axiosRes.headers;
                        response = new response_1.default();
                        response.headers = headers;
                        response.status_code = status_1;
                        response.data = axiosRes.data;
                        return [2 /*return*/, response];
                    case 2:
                        e_1 = _a.sent();
                        response = new response_1.default();
                        response.headers = e_1.response.headers;
                        response.status_code = e_1.response.status;
                        response.data = e_1.response.data;
                        response.message = e_1.response.statusText;
                        return [2 /*return*/, response];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return Request;
}());
exports.default = Request;
