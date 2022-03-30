import WatchableProps from "../types/WatchableProps";
import Request from "../request";
import Response from "../response";
import validate from "../middleware/validate";
import Controller from "../graph/controller";
import "reflect-metadata";


export default function (props: WatchableProps): any {
    props.immediate = typeof props.immediate == 'undefined' ? true : !!props.immediate;

    return function (target: Controller, propertyKey: string, descriptor: PropertyDescriptor) {
        // target.watched[''];


        // descriptor.
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any) {

            let request = args[1] as Request
            let response = args[0] as Response

            //check middleware first

            let middlewareCheck = await validate(props.middlewares, response, request)
            if (middlewareCheck !== null) {
                return function (...args: any) {
                    return middlewareCheck
                }
            }


            const watchedMetadataKey = request.id + ":watched";

            let key = propertyKey;
            let resFunc = props.immediate ? originalMethod(...args) : response.success("");

            resFunc.responseChanged = false;

            type DataStruct = {
                value: any,
                response: Response,
                changed: boolean,
                firstCall: boolean,
                reqData: string
            }

            let prev: DataStruct = Reflect.getOwnMetadata(watchedMetadataKey, target, key) || {
                value: null,
                firstCall: true,
                changed: true,
                response: resFunc,
                reqData: JSON.stringify(request.data ?? '')
            };
            //check for middlewares validity


            let reqData = JSON.stringify(request.data ?? '')
            let forceNewRes = prev.reqData !== reqData

            let responseToShow: Response = forceNewRes ? originalMethod(...args):prev.response;

            // get watchable function
            let watching = JSON.stringify(await props.watch(request));

            let somethingChanged = false;


            if (((prev.firstCall && props.immediate) || prev.value !== watching) && !forceNewRes) {
                console.log("Something changed>>>>>>>")
                // console.log({prevData: prev.value})
                // console.log({watching})
                responseToShow = await originalMethod.apply(this, args)
                prev.changed = true;
            } else {
                prev.changed = false;
            }

            props.immediate = false;
            prev.firstCall = false;
            prev.reqData = reqData;

            responseToShow.responseChanged = false;

            //ignore next line
            prev.value = watching;
            prev.response = responseToShow

            responseToShow.responseChanged = prev.changed;

            Reflect.defineMetadata(watchedMetadataKey, prev, target, key);

            return responseToShow;
        };

        return descriptor;
    }
}