"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const response_1 = __importDefault(require("../response"));
async function default_1(middlewares, res, req) {
    for (let index in middlewares) {
        let middleware = middlewares[index];
        if (typeof middleware.boot == 'function') {
            let boot = await middleware.boot(res, req);
            if (boot instanceof response_1.default) {
                return boot;
            }
            continue;
        }
        if (typeof middleware.validate == 'function' && !await middleware.validate(req)) {
            if (typeof middleware.onFailure == 'function') {
                let middlewareResponse = middleware.onFailure(res, req);
                if (middlewareResponse.statusCode < 300)
                    middlewareResponse.statusCode = 401;
                return middlewareResponse;
            }
            else {
                return (new response_1.default()).error(`${index} failed but has no onFailure method response`);
            }
        }
    }
    return null;
}
exports.default = default_1;
