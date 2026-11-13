"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamableMetadataKey = void 0;
const socket_1 = __importDefault(require("../socket"));
const validate_1 = __importDefault(require("../middleware/validate"));
require("reflect-metadata");
const exposed_1 = require("./exposed");
exports.streamableMetadataKey = "avanda:streamable";
function default_1(props = {}) {
    return function (target, propertyKey, descriptor) {
        Reflect.defineMetadata(exports.streamableMetadataKey, props, target, propertyKey);
        (0, exposed_1.expose)(target, propertyKey);
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            let response = args[0];
            let request = args[1];
            let model = args[2];
            if (!response.wsCLient)
                return response.error("Streamable methods are only available over websockets");
            response.socket = new socket_1.default(response.wsCLient);
            let middlewareCheck = await (0, validate_1.default)(props.middlewares, response, request, model);
            if (middlewareCheck) {
                response.socket.close(4401, middlewareCheck.message);
                return null;
            }
            return originalMethod.apply(this, args);
        };
        return descriptor;
    };
}
exports.default = default_1;
