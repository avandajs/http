"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Broadcastable = exports.EventStorageDriver = void 0;
const events_1 = __importDefault(require("events"));
/*
 * GOALS:
 * --
 */
class EventStorageDriver {
    constructor(model) {
        this.eventKey = "event";
        this.payloadKey = "payload";
        this.model = model;
    }
}
exports.EventStorageDriver = EventStorageDriver;
class Event {
    static async init() {
        if (!Event.driver)
            throw new Error("Event storage driver not set");
        try {
            this.eventQueue = await new Event.driver.model().setPerPage(1000000).all();
        }
        catch (e) {
            throw new Error(e.message);
        }
    }
    static setDriver(driver) {
        Event.driver = driver;
    }
    static async emitEvent(event, payload, update = true) {
        if (Event.eventListeners.length) {
            let foundEvent = false;
            for (const listener of Event.eventListeners) {
                if (typeof listener[event] != "undefined") {
                    // immediately call the callback with the payload
                    listener[event](...payload);
                    foundEvent = true;
                }
            }
            if (!foundEvent) {
                if (update) {
                    // delete logged events before you push new one
                    await new Event.driver.model().where({ [Event.driver.eventKey]: event }).delete();
                }
                await new Event.driver.model().create({
                    [Event.driver.eventKey]: event,
                    [Event.driver.payloadKey]: JSON.stringify(payload[0])
                });
            }
        }
        else {
            await new Event.driver.model().create({
                [Event.driver.eventKey]: event,
                [Event.driver.payloadKey]: JSON.stringify(payload[0])
            });
        }
    }
    static async emit(event, ...payload) {
        Event.emitEvent(event, payload, false);
    }
    static async on(event, callback, fallBack) {
        //   check if event is in database logged
        console.info("Listening to event: ", event, "\n");
        let storedEvents = await new Event.driver.model()
            .where({ [Event.driver.eventKey]: event })
            .all();
        if (storedEvents && storedEvents.length > 0) {
            for (const storedEvent of storedEvents) {
                callback(storedEvent[Event.driver.payloadKey]);
            }
            // delete all event from queue
            await new Event.driver.model()
                .where({ [Event.driver.eventKey]: event })
                .delete();
        }
        else {
            fallBack && fallBack();
        }
        // add event to queue
        Event.eventListeners.push({
            [event]: callback,
        });
    }
    static remove(event) {
        if (Event.eventListeners.length) {
            for (let index = 0; index < Event.eventListeners.length; index++) {
                const listener = Event.eventListeners[index];
                if (typeof listener[event] != "undefined") {
                    // immediately call the callback with the payload
                    Event.eventListeners.splice(index, 1);
                    console.log('removing event:  ', event);
                }
            }
        }
    }
}
exports.default = Event;
Event.EventEmitter = new events_1.default();
Event.eventQueue = []; // fetch this from db
Event.eventListeners = [];
class Broadcastable {
    defaultPayload() {
        return null;
    }
    broadcast() {
        Event.emit(this.path, this.payload);
    }
}
exports.Broadcastable = Broadcastable;
