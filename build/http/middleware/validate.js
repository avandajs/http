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
var response_1 = __importDefault(require("../response"));
function default_1(middlewares, res, req) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, _i, index, middleware, boot, _c, middlewareResponse;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = [];
                    for (_b in middlewares)
                        _a.push(_b);
                    _i = 0;
                    _d.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 7];
                    index = _a[_i];
                    middleware = middlewares[index];
                    if (!(typeof middleware.boot == 'function')) return [3 /*break*/, 3];
                    return [4 /*yield*/, middleware.boot(res, req)];
                case 2:
                    boot = _d.sent();
                    if (boot instanceof response_1.default) {
                        return [2 /*return*/, boot];
                    }
                    return [3 /*break*/, 6];
                case 3:
                    _c = typeof middleware.validate == 'function';
                    if (!_c) return [3 /*break*/, 5];
                    return [4 /*yield*/, middleware.validate(req)];
                case 4:
                    _c = !(_d.sent());
                    _d.label = 5;
                case 5:
                    if (_c) {
                        if (typeof middleware.onFailure == 'function') {
                            middlewareResponse = middleware.onFailure(res, req);
                            if (middlewareResponse.statusCode < 300)
                                middlewareResponse.statusCode = 401;
                            return [2 /*return*/, middlewareResponse];
                        }
                        else {
                            return [2 /*return*/, (new response_1.default()).error(index + " failed but has no onFailure method response")];
                        }
                    }
                    _d.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, null];
            }
        });
    });
}
exports.default = default_1;
