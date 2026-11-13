import { DataOf, Model } from "@avanda/orm";
import { Redis } from "@avanda/app";
import EventEmitter from "events";
import { createHash, timingSafeEqual } from "crypto";
import Request from "../request";
import Query from "./query";

process.setMaxListeners(0);

/*
 * GOALS:
 * --
 */
EventEmitter.defaultMaxListeners = 15;

export class EventStorageDriver {
  model?: any;
  constructor(model: typeof Model) {
    this.model = model;
  }
  eventKey: string = "event";
  payloadKey: string = "payload";
}

export default class Event {
  private static EventEmitter: EventEmitter = new EventEmitter().setMaxListeners(0);
  private static remoteEventServiceUrl: string;

  static setRemoteEventServiceUrl(url: string) {
    Event.remoteEventServiceUrl = url;
  }

  // The event route lets a caller push any payload to every watcher, so it only
  // answers callers that send AVANDA_EVENT_SECRET in this header. With no secret
  // configured the route refuses everyone.
  static secretHeader: string = "x-avanda-event-secret";

  static get secret(): string | null {
    return process.env.AVANDA_EVENT_SECRET || null;
  }

  static isAuthorized(provided: unknown): boolean {
    const secret = Event.secret;
    if (!secret || typeof provided != "string") return false;
    const digest = (value: string) => createHash("sha256").update(value).digest();
    return timingSafeEqual(digest(provided), digest(secret));
  }

  // a connection in subscriber mode can't run other commands, so it's kept apart from RedisClient.instance
  private static subscriber?: Promise<typeof Redis.RedisClient.instance>;

  constructor() {}
  static setDriver(driver: EventStorageDriver) {}

  private static channel(event: string) {
    return "avanda:event:" + event;
  }

  private static getSubscriber() {
    const redis = Redis.RedisClient.instance;
    if (!redis?.isReady) return null;
    Event.subscriber ??= redis.duplicate().connect();
    return Event.subscriber;
  }

  static async emitEvent(event: string, payload: any[]) {
    const redis = Redis.RedisClient.instance;
    if (redis?.isReady) {
      await redis.publish(Event.channel(event), JSON.stringify(payload));
      return;
    }
    Event.EventEmitter.emit(event, ...payload);
  }

  static async emit(event: string, ...payload: any) {
    console.log(">>>>Emitting event: " + event);

    console.log(">> remote server: ", Event.remoteEventServiceUrl);
    if (Event.remoteEventServiceUrl) {
      try {
        let uri = Event.remoteEventServiceUrl + Query.eventPath;
        if (!Event.secret)
          console.error(
            "[avanda/http] AVANDA_EVENT_SECRET is not set, the remote event service will refuse this event"
          );
        let res = await new Request()
          .setHeaders({ [Event.secretHeader]: Event.secret ?? "" })
          .post(uri, {
            payload: JSON.stringify(payload),
            event,
          });
        if (res.statusCode !== 200)
          console.error(
            `[avanda/http] remote event service answered ${res.statusCode} for ${event}`
          );
      } catch (e) {
        console.log({ e });
      }
    } else {
      Event.emitEvent(event, payload);
    }
  }

  static async on(event: string, callback: (...payload: any) => void) {
    //   check if event is in database logged
    console.log(">>>>Listening to event: " + event);
    const isFirstListener = Event.EventEmitter.listenerCount(event) == 0;
    Event.EventEmitter.on(event, callback);

    const subscriber = await Event.getSubscriber();
    if (subscriber && isFirstListener) {
      // runs inside the Redis client, where a throw would take the process down
      await subscriber.subscribe(Event.channel(event), (message) => {
        try {
          const payload = JSON.parse(message);
          if (!Array.isArray(payload)) throw new Error("payload is not an array");
          Event.EventEmitter.emit(event, ...payload);
        } catch (e) {
          console.error(`[avanda/http] dropped a malformed ${event} event:`, e);
        }
      });
    }
  }

  // drops one listener; the Redis subscription stays while any local listener remains
  static async remove(event: string, callback: (...payload: any) => void) {
    console.log(">>>>>Removing event: ", event);
    Event.EventEmitter.off(event, callback);
    if (Event.EventEmitter.listenerCount(event) > 0) return;

    const subscriber = await Event.getSubscriber();
    await subscriber?.unsubscribe(Event.channel(event));
  }
}

export abstract class Broadcastable<T = unknown> {
  abstract get channel(): string;
  abstract payload(): Promise<any> | any;

  defaultPayload(): Promise<any> | null {
    return null;
  }

  multipleDefaultPayload(): Promise<any[]> | [] {
    return [];
  }

  async broadcast<T>(payload?: T) {
    Event.emit(this.channel, payload ? await payload : await this.payload());
  }
}
