import WatchableProps from "../types/WatchableProps";
import Request from "../request";
import Response from "../response";
import validate from "../middleware/validate";
import Controller from "../graph/controller";
import "reflect-metadata";
import { Model } from "@avanda/orm";
import Event, { Broadcastable } from "../graph/event";
import { clientErrorResponse, logRenderError } from "../errors";

export default function (props: WatchableProps): any {
  props.immediate =
    typeof props.immediate == "undefined" ? true : props.immediate;

  return function (
    target: Controller,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {

    // target.watched[''];

    // descriptor.
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any) {
      let request = args[1] as Request;

      let model = args[2] as Model;
      let response = args[0] as Response;
      const watchedMetadataKey = request.id + ":watched";
      let key = propertyKey;

      let hasStartedWatch =
      Reflect.getOwnMetadata(watchedMetadataKey, target, key) || false;

      if (!request.executeWatchable || hasStartedWatch) {
        return await originalMethod.apply(this, args);
      }

      if (typeof props.event != "undefined") {
        
        let middlewareCheck = await validate(
          props.middlewares,
          response,
          request,
          model
        );
        if (!middlewareCheck) {
          let event =
            typeof props.event == "function"
              ? props.event(request)
              : props.event;
          let eventPath = typeof event == "string" ? event : event.channel;

          let defaultPayload = null;
          let multipleDefaultPayload = [];

          if (event instanceof Broadcastable) {
            defaultPayload = await event.defaultPayload();
            multipleDefaultPayload = await event.multipleDefaultPayload();
          }

          if (!eventPath) return null;

          // runs as an event listener and from timers, where nothing awaits it,
          // so it must never reject
          const eventCallback =  async (payload) => {
            try {
              payload =
                typeof payload == "string" ? JSON.parse(payload) : payload;
              request.setPayload(payload);
              let resp = await request.generateResponseFromGraph(false);
              response.sendResponseAsWsMessage(resp);
            } catch (e) {
              logRenderError(`watch event ${eventPath}`, e);
              try {
                response.sendResponseAsWsMessage(clientErrorResponse(e));
              } catch (sendError) {
                console.error("[avanda/http] websocket send failed:", sendError);
              }
            }
          }

          const previousClose = request.onClosedCallback;
          request.onClosedCallback = async () => {
            await previousClose?.();
            await Event.remove(eventPath, eventCallback);
          };

          Event.on(eventPath, eventCallback).catch((e) =>
            console.error(`[avanda/http] could not listen to ${eventPath}:`, e)
          );

          // send default payload to client if exist
          if (defaultPayload) {
            eventCallback(defaultPayload);
          }

          if (multipleDefaultPayload?.length) {
            for (
              let index = 0;
              index < multipleDefaultPayload.length;
              index++
            ) {
              const payload = multipleDefaultPayload[index];
              setTimeout(() => eventCallback(payload), 3000 * index); //send notification in 3 seconds interval
            }
          }
        } else {
          response.sendResponseAsWsMessage(middlewareCheck);
        }
      } else {
        return null;
      }
    };

    return descriptor;
  };
}
