import StreamableProps from "../types/StreamableProps";
import Request from "../request";
import Response from "../response";
import StreamSocket from "../socket";
import validate from "../middleware/validate";
import Controller from "../graph/controller";
import "reflect-metadata";
import { Model } from "@avanda/orm";
import { expose } from "./exposed";

export const streamableMetadataKey = "avanda:streamable";

export default function (props: StreamableProps = {}): any {
  return function (
    target: Controller,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata(streamableMetadataKey, props, target, propertyKey);
    expose(target, propertyKey);

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any) {
      let response = args[0] as Response;
      let request = args[1] as Request;
      let model = args[2] as Model;

      if (!response.wsCLient)
        return response.error("Streamable methods are only available over websockets");

      response.socket = new StreamSocket(response.wsCLient);

      let middlewareCheck = await validate(
        props.middlewares,
        response,
        request,
        model
      );
      if (middlewareCheck) {
        response.socket.close(4401, middlewareCheck.message);
        return null;
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
