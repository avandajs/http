import { DataOf, Model } from "@avanda/orm";
import EventEmitter from "events";
import Request from "../request";
import Query from "./query";

process.setMaxListeners(0);

/*
 * GOALS:
 * --
 */
EventEmitter.defaultMaxListeners = 15

export class EventStorageDriver {
  model?: any;
  constructor(model: typeof Model) {
    this.model = model;
  }
  eventKey: string = "event";
  payloadKey: string = "payload";
}

export default class Event {
  private static EventEmitter: EventEmitter = new EventEmitter();
  private static remoteEventServiceUrl: string;
  

  static setRemoteEventServiceUrl(url: string){
    Event.remoteEventServiceUrl = url;
  }




  constructor(){

  }
  static setDriver(driver: EventStorageDriver) {
  }

  static async emitEvent(event: string,payload: any[]){
    Event.EventEmitter.emit(event,...payload)
  }



  static async emit(event: string, ...payload: any) {
    console.log(">>>>Emitting event: " + event)

    console.log(">> remote server: ", Event.remoteEventServiceUrl)
    if(Event.remoteEventServiceUrl){
      try{
        let uri = Event.remoteEventServiceUrl + Query.eventPath;
        let res = await new Request().post(uri,{
          payload: JSON.stringify(payload),
          event
        })
      } catch(e){
        console.log({e});
      }
    }else{
      Event.emitEvent(event,payload)
    }
    
  }

  static async on(event: string, callback: (...payload: any) => void) {
    //   check if event is in database logged
    console.log(">>>>Listening to event: " + event)
    Event.EventEmitter.addListener(event,callback).setMaxListeners(1)
  }

  static remove(event: string){
    console.log(">>>>>Removing event: ", event)
    Event.EventEmitter.removeAllListeners(event)
  }
}

export abstract class Broadcastable{
  abstract get path(): string
  abstract payload(): Promise<any> | any

  defaultPayload(): Promise<any> | null {
    return null;
  }



  multipleDefaultPayload(): Promise<any[]> | [] {
    return [];
  }

  
  async broadcast(){
    Event.emit(this.path,await this.payload())
  }
}

