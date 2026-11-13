"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validate_1 = __importDefault(require("../middleware/validate"));
require("reflect-metadata");
const event_1 = __importStar(require("../graph/event"));
const errors_1 = require("../errors");
function default_1(props) {
    props.immediate =
        typeof props.immediate == "undefined" ? true : props.immediate;
    return function (target, propertyKey, descriptor) {
        // target.watched[''];
        // descriptor.
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            let request = args[1];
            let model = args[2];
            let response = args[0];
            const watchedMetadataKey = request.id + ":watched";
            let key = propertyKey;
            let hasStartedWatch = Reflect.getOwnMetadata(watchedMetadataKey, target, key) || false;
            if (!request.executeWatchable || hasStartedWatch) {
                return await originalMethod.apply(this, args);
            }
            if (typeof props.event != "undefined") {
                let middlewareCheck = await (0, validate_1.default)(props.middlewares, response, request, model);
                if (!middlewareCheck) {
                    let event = typeof props.event == "function"
                        ? props.event(request)
                        : props.event;
                    let eventPath = typeof event == "string" ? event : event.channel;
                    let defaultPayload = null;
                    let multipleDefaultPayload = [];
                    if (event instanceof event_1.Broadcastable) {
                        defaultPayload = await event.defaultPayload();
                        multipleDefaultPayload = await event.multipleDefaultPayload();
                    }
                    if (!eventPath)
                        return null;
                    // runs as an event listener and from timers, where nothing awaits it,
                    // so it must never reject
                    const eventCallback = async (payload) => {
                        try {
                            payload =
                                typeof payload == "string" ? JSON.parse(payload) : payload;
                            request.setPayload(payload);
                            let resp = await request.generateResponseFromGraph(false);
                            response.sendResponseAsWsMessage(resp);
                        }
                        catch (e) {
                            (0, errors_1.logRenderError)(`watch event ${eventPath}`, e);
                            try {
                                response.sendResponseAsWsMessage((0, errors_1.clientErrorResponse)(e));
                            }
                            catch (sendError) {
                                console.error("[avanda/http] websocket send failed:", sendError);
                            }
                        }
                    };
                    const previousClose = request.onClosedCallback;
                    request.onClosedCallback = async () => {
                        await (previousClose === null || previousClose === void 0 ? void 0 : previousClose());
                        await event_1.default.remove(eventPath, eventCallback);
                    };
                    event_1.default.on(eventPath, eventCallback).catch((e) => console.error(`[avanda/http] could not listen to ${eventPath}:`, e));
                    // send default payload to client if exist
                    if (defaultPayload) {
                        eventCallback(defaultPayload);
                    }
                    if (multipleDefaultPayload === null || multipleDefaultPayload === void 0 ? void 0 : multipleDefaultPayload.length) {
                        for (let index = 0; index < multipleDefaultPayload.length; index++) {
                            const payload = multipleDefaultPayload[index];
                            setTimeout(() => eventCallback(payload), 3000 * index); //send notification in 3 seconds interval
                        }
                    }
                }
                else {
                    response.sendResponseAsWsMessage(middlewareCheck);
                }
            }
            else {
                return null;
            }
        };
        return descriptor;
    };
}
exports.default = default_1;
