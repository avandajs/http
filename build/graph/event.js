"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Broadcastable = exports.EventStorageDriver = void 0;
const app_1 = require("@avanda/app");
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
    static setRemoteEventServiceUrl(url) {
        Event.remoteEventServiceUrl = url;
    }
    constructor() { }
    static setDriver(driver) { }
    static channel(event) {
        return "avanda:event:" + event;
    }
    static getSubscriber() {
        var _a;
        const redis = app_1.Redis.RedisClient.instance;
        if (!(redis === null || redis === void 0 ? void 0 : redis.isReady))
            return null;
        (_a = Event.subscriber) !== null && _a !== void 0 ? _a : (Event.subscriber = redis.duplicate().connect());
        return Event.subscriber;
    }
    static async emitEvent(event, payload) {
        const redis = app_1.Redis.RedisClient.instance;
        if (redis === null || redis === void 0 ? void 0 : redis.isReady) {
            await redis.publish(Event.channel(event), JSON.stringify(payload));
            return;
        }
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
        const isFirstListener = Event.EventEmitter.listenerCount(event) == 0;
        Event.EventEmitter.on(event, callback);
        const subscriber = await Event.getSubscriber();
        if (subscriber && isFirstListener) {
            await subscriber.subscribe(Event.channel(event), (message) => {
                Event.EventEmitter.emit(event, ...JSON.parse(message));
            });
        }
    }
    // drops one listener; the Redis subscription stays while any local listener remains
    static async remove(event, callback) {
        console.log(">>>>>Removing event: ", event);
        Event.EventEmitter.off(event, callback);
        if (Event.EventEmitter.listenerCount(event) > 0)
            return;
        const subscriber = await Event.getSubscriber();
        await (subscriber === null || subscriber === void 0 ? void 0 : subscriber.unsubscribe(Event.channel(event)));
    }
}
Event.EventEmitter = new events_1.default().setMaxListeners(0);
exports.default = Event;
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
