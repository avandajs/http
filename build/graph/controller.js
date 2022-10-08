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
}
exports.default = Controller;
