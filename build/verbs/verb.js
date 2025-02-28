"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validate_1 = __importDefault(require("../middleware/validate"));
function default_1(middlewares, method) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            var _a, _b;
            let request = args[1];
            let response = args[0];
            let model = args[2];
            if (((_a = request === null || request === void 0 ? void 0 : request.method) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== method && !request.isWatcher) {
                //invalid request
                return function (...args) {
                    return response.error(`Bad request type, ${request === null || request === void 0 ? void 0 : request.method}`, 500);
                };
            }
            else if (((_b = request === null || request === void 0 ? void 0 : request.method) === null || _b === void 0 ? void 0 : _b.toLowerCase()) == "options" &&
                !request.isWatcher) {
                return function (...args) {
                    return response.success("Preflight", 200);
                };
            }
            //check for middlewares validity
            let middlewareCheck = await (0, validate_1.default)(middlewares, response, request, model);
            if (middlewareCheck !== null && !request.isWatcher) {
                return function (...args) {
                    return middlewareCheck;
                };
            }
            // console.log({args})
            //ignore next line
            Object.defineProperty(this, "request_method", { value: "get" });
            return originalMethod.apply(this, args);
        };
        return descriptor;
    };
}
exports.default = default_1;
