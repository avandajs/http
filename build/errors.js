"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logRenderError = exports.clientErrorResponse = exports.isInvalidFrame = exports.isInvalidQuery = exports.isServiceNotFound = exports.InvalidFrameError = exports.InvalidQueryError = exports.ServiceNotFoundError = exports.INVALID_FRAME = exports.INVALID_QUERY = exports.SERVICE_NOT_FOUND = void 0;
const response_1 = __importDefault(require("./response"));
exports.SERVICE_NOT_FOUND = "AVANDA_SERVICE_NOT_FOUND";
exports.INVALID_QUERY = "AVANDA_INVALID_QUERY";
exports.INVALID_FRAME = "AVANDA_INVALID_FRAME";
/**
 * Thrown when a request names a controller or function that can't be served.
 * The message is the same for both cases because some websocket paths forward
 * error messages to the client; what was actually missing is kept in `detail`
 * for server-side logs only.
 */
class ServiceNotFoundError extends Error {
    constructor(detail) {
        super("Not found");
        this.code = exports.SERVICE_NOT_FOUND;
        this.name = "ServiceNotFoundError";
        this.detail = detail;
    }
}
exports.ServiceNotFoundError = ServiceNotFoundError;
/** Thrown when the `query` of a graph request can't be read as a service. */
class InvalidQueryError extends Error {
    constructor() {
        super("Invalid query");
        this.code = exports.INVALID_QUERY;
        this.name = "InvalidQueryError";
    }
}
exports.InvalidQueryError = InvalidQueryError;
/** Thrown when a websocket text frame isn't valid JSON. */
class InvalidFrameError extends Error {
    constructor() {
        super("Invalid frame");
        this.code = exports.INVALID_FRAME;
        this.name = "InvalidFrameError";
    }
}
exports.InvalidFrameError = InvalidFrameError;
// matched on `code`, so it still works when two copies of this package are loaded
function isServiceNotFound(e) {
    return (e === null || e === void 0 ? void 0 : e.code) === exports.SERVICE_NOT_FOUND;
}
exports.isServiceNotFound = isServiceNotFound;
function isInvalidQuery(e) {
    return (e === null || e === void 0 ? void 0 : e.code) === exports.INVALID_QUERY;
}
exports.isInvalidQuery = isInvalidQuery;
function isInvalidFrame(e) {
    return (e === null || e === void 0 ? void 0 : e.code) === exports.INVALID_FRAME;
}
exports.isInvalidFrame = isInvalidFrame;
/**
 * The response a client is allowed to see for an error thrown while rendering
 * a service. Never carries the original message or stack.
 */
function clientErrorResponse(e) {
    const response = new response_1.default();
    response.data = null;
    if (isServiceNotFound(e)) {
        response.statusCode = 404;
        response.message = "Not found";
    }
    else if (isInvalidQuery(e)) {
        response.statusCode = 400;
        response.message = "Invalid query";
    }
    else if (isInvalidFrame(e)) {
        response.statusCode = 400;
        response.message = "Invalid frame";
    }
    else {
        response.statusCode = 500;
        response.message = "Internal server error";
    }
    return response;
}
exports.clientErrorResponse = clientErrorResponse;
/** Logs the real error server-side. Lookup misses are one line, without a stack. */
function logRenderError(context, e) {
    if (isServiceNotFound(e)) {
        console.warn(`[avanda/http] ${context}: not found (${e.detail})`);
    }
    else if (isInvalidQuery(e)) {
        console.warn(`[avanda/http] ${context}: invalid query`);
    }
    else if (isInvalidFrame(e)) {
        console.warn(`[avanda/http] ${context}: invalid frame`);
    }
    else {
        console.error(`[avanda/http] ${context} failed:`, e);
    }
}
exports.logRenderError = logRenderError;
