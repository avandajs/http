"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const verb_1 = __importDefault(require("./verb"));
function default_1(...middlewares) {
    return (0, verb_1.default)(middlewares, 'get');
}
exports.default = default_1;
//# sourceMappingURL=get.js.map