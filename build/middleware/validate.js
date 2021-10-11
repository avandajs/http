"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function default_1(middlewares, res, req) {
    for (let index in middlewares) {
        let middleware = middlewares[index];
        if (!middleware.validate(res, req)) {
            let middlewareResponse = middleware.onFailure(res, req);
            if (middlewareResponse.status_code < 300)
                middlewareResponse.status_code = 401;
            return middlewareResponse;
        }
    }
    return null;
}
exports.default = default_1;
