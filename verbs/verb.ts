import { Middleware } from "../middleware";
import Request from "../request";
import Response from "../response";
import validate from "../middleware/validate";
import { Model } from "@avanda/orm";

export default function (middlewares: Middleware[], method: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any) {
      let request = args[1] as Request;
      let response = args[0] as Response;
      let model = args[2] as Model;


      if (request?.method?.toLowerCase() !== method && !request.isWatcher) {
        //invalid request
        return function (...args: any) {
          return response.error(`Bad request type, ${request?.method}`, 500);
        };
      } else if (
        request?.method?.toLowerCase() == "options" &&
        !request.isWatcher
      ) {
        return function (...args: any) {
          return response.success("Preflight", 200);
        };
      }
      //check for middlewares validity
      let middlewareCheck = await validate(
        middlewares,
        response,
        request,
        model
      );
      if (middlewareCheck !== null && !request.isWatcher) {
        return function (...args: any) {
          return middlewareCheck;
        };
      }

      // console.log({args})
      //ignore next line
      Object.defineProperty(this, "request_method", { value: "get" });

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
