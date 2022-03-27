"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const controller_1 = __importDefault(require("./graph/controller"));
const response_1 = __importDefault(require("./response"));
const request_1 = __importDefault(require("./request"));
const watchable_1 = __importDefault(require("./verbs/watchable"));
class Test extends controller_1.default {
    async get(response, request) {
        return super.get(response, request);
    }
}
__decorate([
    (0, watchable_1.default)({
        watch: (context) => true
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [response_1.default, request_1.default]),
    __metadata("design:returntype", Promise)
], Test.prototype, "get", null);
exports.default = Test;
