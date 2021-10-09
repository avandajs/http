"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Response {
    constructor() {
        this.status_code = 0;
    }
    status(code) {
        this.status_code = code;
    }
    json(data) {
    }
    success(msg, data = null, code = 200) {
        this.status_code = code;
        this.data = data;
        this.message = msg;
        return this;
    }
    error(msg, code = 401, data = null) {
        this.status_code = 400;
        this.data = data;
        this.message = msg;
        return this;
    }
}
exports.default = Response;
//# sourceMappingURL=response.js.map