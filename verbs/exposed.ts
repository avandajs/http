// The methods a client may call by name. Only the verb, @Watchable and
// @Streamable decorators add to it, so a helper on a controller is never an
// endpoint. Kept under a registered symbol so it still works when two copies
// of this package are loaded.
const exposedKey = Symbol.for("avanda:http:exposed");

const hasOwn = (target: any, key: string | symbol): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

export function expose(target: any, propertyKey: string) {
  if (!hasOwn(target, exposedKey))
    Object.defineProperty(target, exposedKey, { value: new Set<string>() });
  target[exposedKey].add(propertyKey);
}

// The class that defines the method must also be the one that decorated it:
// an undecorated override in a subclass doesn't inherit its parent's exposure.
export function isExposed(controller: any, propertyKey: string): boolean {
  for (
    let target = controller;
    target && target !== Object.prototype;
    target = Object.getPrototypeOf(target)
  ) {
    if (hasOwn(target, propertyKey))
      return hasOwn(target, exposedKey) && target[exposedKey].has(propertyKey);
  }
  return false;
}
