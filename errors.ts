import Response from "./response";

export const SERVICE_NOT_FOUND = "AVANDA_SERVICE_NOT_FOUND";
export const INVALID_QUERY = "AVANDA_INVALID_QUERY";
export const INVALID_FRAME = "AVANDA_INVALID_FRAME";

/**
 * Thrown when a request names a controller or function that can't be served.
 * The message is the same for both cases because some websocket paths forward
 * error messages to the client; what was actually missing is kept in `detail`
 * for server-side logs only.
 */
export class ServiceNotFoundError extends Error {
  readonly code = SERVICE_NOT_FOUND;
  readonly detail: string;

  constructor(detail: string) {
    super("Not found");
    this.name = "ServiceNotFoundError";
    this.detail = detail;
  }
}

/** Thrown when the `query` of a graph request can't be read as a service. */
export class InvalidQueryError extends Error {
  readonly code = INVALID_QUERY;

  constructor() {
    super("Invalid query");
    this.name = "InvalidQueryError";
  }
}

/** Thrown when a websocket text frame isn't valid JSON. */
export class InvalidFrameError extends Error {
  readonly code = INVALID_FRAME;

  constructor() {
    super("Invalid frame");
    this.name = "InvalidFrameError";
  }
}

// matched on `code`, so it still works when two copies of this package are loaded
export function isServiceNotFound(e: any): e is ServiceNotFoundError {
  return e?.code === SERVICE_NOT_FOUND;
}

export function isInvalidQuery(e: any): e is InvalidQueryError {
  return e?.code === INVALID_QUERY;
}

export function isInvalidFrame(e: any): e is InvalidFrameError {
  return e?.code === INVALID_FRAME;
}

/**
 * The response a client is allowed to see for an error thrown while rendering
 * a service. Never carries the original message or stack.
 */
export function clientErrorResponse(e: unknown): Response {
  const response = new Response();
  response.data = null;
  if (isServiceNotFound(e)) {
    response.statusCode = 404;
    response.message = "Not found";
  } else if (isInvalidQuery(e)) {
    response.statusCode = 400;
    response.message = "Invalid query";
  } else if (isInvalidFrame(e)) {
    response.statusCode = 400;
    response.message = "Invalid frame";
  } else {
    response.statusCode = 500;
    response.message = "Internal server error";
  }
  return response;
}

/** Logs the real error server-side. Lookup misses are one line, without a stack. */
export function logRenderError(context: string, e: unknown) {
  if (isServiceNotFound(e)) {
    console.warn(`[avanda/http] ${context}: not found (${e.detail})`);
  } else if (isInvalidQuery(e)) {
    console.warn(`[avanda/http] ${context}: invalid query`);
  } else if (isInvalidFrame(e)) {
    console.warn(`[avanda/http] ${context}: invalid frame`);
  } else {
    console.error(`[avanda/http] ${context} failed:`, e);
  }
}
