"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Controller {
    constructor(connection, model = null) {
        this.connection = connection;
        if (model) {
            this.model = model;
            this.model.setModelName(this.model.constructor.name);
        }
    }
    async get(response, request) {
        var _a;
        return (await ((_a = this.model) === null || _a === void 0 ? void 0 : _a.first()));
    }
    async getAll(response, request) {
        var _a;
        return (await ((_a = this.model) === null || _a === void 0 ? void 0 : _a.all()));
    }
    async getAllByPage(response, request) {
        var _a;
        let data = await ((_a = this.model) === null || _a === void 0 ? void 0 : _a.page(request.page));
        response.totalPages = this.model.totalPages;
        response.currentPage = request.page;
        response.perPage = this.model.perPage;
        return response.success('Data fetched', data);
    }
}
exports.default = Controller;
