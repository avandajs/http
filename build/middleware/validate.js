"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const response_1 = __importDefault(require("../response"));
async function default_1(middlewares, res, req, model) {
    for (let index in middlewares) {
        let middleware = middlewares[index];
        if (typeof middleware.boot != 'undefined') {
            let boot = await middleware.boot(res, req, model);
            if (boot instanceof response_1.default) {
                boot.isMiddlewareRes = true;
                return boot;
            }
            else if (boot === false) {
                let newRes = new response_1.default();
                newRes.isMiddlewareRes = true;
                return newRes.error(`${index} failed but has no onFailure method response`);
            }
            continue;
        }
        else if (typeof middleware.validate == 'function' && !await middleware.validate(req)) {
            if (typeof middleware.onFailure == 'function') {
                let middlewareResponse = middleware.onFailure(res, req);
                if (middlewareResponse.statusCode < 300)
                    middlewareResponse.statusCode = 401;
                middlewareResponse.isMiddlewareRes = true;
                return middlewareResponse;
            }
            else {
                let newRes = new response_1.default();
                newRes.isMiddlewareRes = true;
                return newRes.error(`${index} failed but has no onFailure method response`);
            }
        }
    }
    return null;
}
exports.default = default_1;
