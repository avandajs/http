import WatchableProps from "../types/WatchableProps";
import Request from "../request";
import Response from "../response";
import validate from "../middleware/validate";
import Controller from "../graph/controller";
import "reflect-metadata";


const watchedMetadataKey = Symbol("watched");

export default function (props: WatchableProps): any {
    props.immediate = typeof props.immediate == 'undefined' ? true : props.immediate;
    return function (target: Controller, propertyKey: string, descriptor: PropertyDescriptor) {
        // target.watched[''];

        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any) {
            let request = args[1] as Request
            let response = args[0] as Response
            let resFunc = props.immediate ? originalMethod(...args) : response.success("");
            resFunc.responseChanged = false;
            let prev: { value: any, response: Response, changed: boolean, firstCall: boolean, } = Reflect.getOwnMetadata(watchedMetadataKey, target, propertyKey) || {
                value: null,
                firstCall: true,
                changed: true,
                response: resFunc
            };

            //check for middlewares validity
            let middlewareCheck = await validate(props.middlewares, response, request)
            if (middlewareCheck !== null) {
                return function (...args: any) {
                    return middlewareCheck
                }
            }

            let responseToShow: Response = prev.response;

            // get watchable function
            let watching = JSON.stringify(await props.watch(request));

            let somethingChanged = false;


            if ((prev.firstCall && props.immediate) ||  prev.value !== watching) {
                console.log("Something changed>>>>>>>")
                // console.log({prevData: prev.value})
                // console.log({watching})
                responseToShow = await originalMethod.apply(this, args)
                prev.changed = true;
            } else {
                prev.changed = false;
            }

            prev.firstCall = false;
            props.immediate = true;

            responseToShow.responseChanged = false;


            //ignore next line
            prev.value = watching;
            prev.response = responseToShow

            responseToShow.responseChanged = prev.changed;

            console.log({responseToShowMutated: responseToShow, changed: prev.changed})

            Reflect.defineMetadata(watchedMetadataKey, prev, target, propertyKey);

            return responseToShow;
        };

        return descriptor;
    }
}