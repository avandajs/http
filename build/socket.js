"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const query_1 = __importDefault(require("./graph/query"));
const response_1 = __importDefault(require("./response"));
class StreamSocket {
    constructor(connection) {
        this.connection = connection;
        this.id = connection.clientId;
    }
    send(data) {
        if (this.connection.readyState !== ws_1.default.OPEN)
            return;
        const response = data instanceof response_1.default ? data : new response_1.default().success("", data);
        this.connection.send(JSON.stringify(query_1.default.responseToObject(response)));
    }
    close(code = 1000, reason = "") {
        // ws throws on a close reason longer than 123 bytes
        while (Buffer.byteLength(reason) > 123)
            reason = reason.slice(0, -1);
        this.connection.close(code, reason);
    }
}
exports.default = StreamSocket;
