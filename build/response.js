"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Response {
    constructor() {
        this.statusCode = 0;
        this.responseChanged = false;
        this.perPage = 0;
    }
    status(code) {
        this.statusCode = code;
    }
    json(data) {
    }
    success(msg, data = null, code = 200) {
        this.statusCode = code;
        this.data = data;
        this.message = msg;
        return this;
    }
    error(msg, code = 401, data = null) {
        this.statusCode = 400;
        this.data = data;
        this.message = msg;
        return this;
    }
}
exports.default = Response;
