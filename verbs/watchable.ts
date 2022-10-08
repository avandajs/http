import WatchableProps from "../types/WatchableProps";
import Request from "../request";
import Response from "../response";
import validate from "../middleware/validate";
import Controller from "../graph/controller";
import "reflect-metadata";
import { Model } from "@avanda/orm";
import Event, { Broadcastable } from "../graph/event";

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
          let eventPath = typeof event == "string" ? event : event.path;

          let defaultPayload = null;
          let multipleDefaultPayload = [];

          if (event instanceof Broadcastable) {
            defaultPayload = await event.defaultPayload();
            multipleDefaultPayload = await event.multipleDefaultPayload();
          }

          if (!eventPath) return null;

          const eventCallback =  async (payload) => {
            payload =
              typeof payload == "string" ? JSON.parse(payload) : payload;
            request.setPayload(payload);
            let resp = await request.generateResponseFromGraph(false);
            response.sendResponseAsWsMessage(resp);
          }

          request.onClosedCallback = () => {
            Event.remove(eventPath);
          };

          Event.on(eventPath, eventCallback);

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
