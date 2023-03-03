"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Broadcastable = exports.EventStorageDriver = void 0;
const events_1 = __importDefault(require("events"));
const request_1 = __importDefault(require("../request"));
const query_1 = __importDefault(require("./query"));
process.setMaxListeners(0);
/*
 * GOALS:
 * --
 */
events_1.default.defaultMaxListeners = 15;
class EventStorageDriver {
    constructor(model) {
        this.eventKey = "event";
        this.payloadKey = "payload";
        this.model = model;
    }
}
exports.EventStorageDriver = EventStorageDriver;
class Event {
    constructor() { }
    static setRemoteEventServiceUrl(url) {
        Event.remoteEventServiceUrl = url;
    }
    static setDriver(driver) { }
    static async emitEvent(event, payload) {
        Event.EventEmitter.emit(event, ...payload);
    }
    static async emit(event, ...payload) {
        console.log(">>>>Emitting event: " + event);
        console.log(">> remote server: ", Event.remoteEventServiceUrl);
        if (Event.remoteEventServiceUrl) {
            try {
                let uri = Event.remoteEventServiceUrl + query_1.default.eventPath;
                let res = await new request_1.default().post(uri, {
                    payload: JSON.stringify(payload),
                    event,
                });
            }
            catch (e) {
                console.log({ e });
            }
        }
        else {
            Event.emitEvent(event, payload);
        }
    }
    static async on(event, callback) {
        //   check if event is in database logged
        console.log(">>>>Listening to event: " + event);
        Event.EventEmitter.addListener(event, callback).setMaxListeners(1);
    }
    static remove(event) {
        console.log(">>>>>Removing event: ", event);
        Event.EventEmitter.removeAllListeners(event);
    }
}
exports.default = Event;
Event.EventEmitter = new events_1.default();
class Broadcastable {
    defaultPayload() {
        return null;
    }
    multipleDefaultPayload() {
        return [];
    }
    async broadcast(payload) {
        Event.emit(this.channel, payload ? await payload : await this.payload());
    }
}
exports.Broadcastable = Broadcastable;
