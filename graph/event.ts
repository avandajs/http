import { DataOf, Model } from "@avanda/orm";
import EventEmitter from "events";
import { type } from "os";

/*
 * GOALS:
 * --
 */


export class EventStorageDriver {
  model?: any;
  constructor(model: typeof Model) {
    this.model = model;
  }
  eventKey: string = "event";
  payloadKey: string = "payload";
}

export default class Event {
  static driver?: EventStorageDriver;
  static Event = new EventEmitter();
  static eventQueue: DataOf<Model>[] = []; // fetch this from db
  static eventListeners: { [event: string]: (...payload) => void }[] = [];

  static async init() {
    if (!Event.driver) throw new Error("Event storage driver not set");
    try {
      this.eventQueue = await new Event.driver.model().setPerPage(1000000).all();
    } catch (e) {
      throw new Error(e.message);
    }
  }

  static setDriver(driver: EventStorageDriver) {
    Event.driver = driver;
  }

  static async emit(event: string, ...payload: any) {
    //   check if we have events listening in queue
    if (Event.eventListeners.length) {
      let foundEvent = false;
      for (const listener of Event.eventListeners) {
        if (typeof listener[event] != "undefined") {
          // immediately call the callback with the payload
          listener[event](...payload);
          foundEvent = true;
        }
      }
      if(!foundEvent){
        await new Event.driver.model().create({
          [Event.driver.eventKey]: event,
          [Event.driver.payloadKey]: JSON.stringify(payload[0])
      })
      }
    }else {
        await new Event.driver.model().create({
            [Event.driver.eventKey]: event,
            [Event.driver.payloadKey]: JSON.stringify(payload[0])
        })
    }
    // if(typeof Event.eventListeners[event] != 'undefined'){
    //     // immediately call the callback with the payload
    //     Event.eventListeners[event](...payload);
    // } else {
    //     // Log this event to database, will be checked next time the on() function is called

    // }
  }

  static async on(event: string, callback: (...payload: any) => void,fallBack?: () => void) {
    //   check if event is in database logged
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
    }else{
      fallBack && fallBack();
    }

    // add event to queue
    Event.eventListeners.push({
      [event]: callback,
    });
  }

  static remove(event: string){
    if (Event.eventListeners.length) {
      for (let index = 0; index < Event.eventListeners.length; index++) {
        const listener = Event.eventListeners[index];
        if (typeof listener[event] != "undefined") {
          // immediately call the callback with the payload
          Event.eventListeners.splice(index,1)
          console.log('removing event:  ', event)
        }
      }
    }
  }
}

export abstract class Broadcastable{
  abstract get path(): string
  abstract get payload(): any

  defaultPayload(): Promise<any> | null {
    return null;
  }

  
  broadcast(){
    Event.emit(this.path,this.payload)
  }
}

