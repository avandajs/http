"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExposed = exports.expose = void 0;
// The methods a client may call by name. Only the verb, @Watchable and
// @Streamable decorators add to it, so a helper on a controller is never an
// endpoint. Kept under a registered symbol so it still works when two copies
// of this package are loaded.
const exposedKey = Symbol.for("avanda:http:exposed");
const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key);
function expose(target, propertyKey) {
    if (!hasOwn(target, exposedKey))
        Object.defineProperty(target, exposedKey, { value: new Set() });
    target[exposedKey].add(propertyKey);
}
exports.expose = expose;
// The class that defines the method must also be the one that decorated it:
// an undecorated override in a subclass doesn't inherit its parent's exposure.
function isExposed(controller, propertyKey) {
    for (let target = controller; target && target !== Object.prototype; target = Object.getPrototypeOf(target)) {
        if (hasOwn(target, propertyKey))
            return hasOwn(target, exposedKey) && target[exposedKey].has(propertyKey);
    }
    return false;
}
exports.isExposed = isExposed;
