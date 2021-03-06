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
            // if (middlewareCheck !== null) {
            //     return function (...args: any) {
            //         middlewareCheck.responseChanged = true;
            //         return middlewareCheck
            //     }
            // }


            const watchedMetadataKey = request.id + ":watched";

            let key = propertyKey;
            let resFunc = middlewareCheck ? middlewareCheck : (props.immediate ? originalMethod(...args) : response.success(""));

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

            let responseToShow: Response = (forceNewRes && !middlewareCheck) ? originalMethod(...args):prev.response;

            // get watchable function
            let watching = JSON.stringify(await props.watch(request));


            if (((prev.firstCall && props.immediate) || prev.value !== watching) && !forceNewRes && !middlewareCheck) {
                console.log("Something changed>>>>>>>")
                responseToShow = await originalMethod.apply(this, args)
                prev.changed = true;
            } else {
                prev.changed = false;
            }

            if(middlewareCheck && prev.firstCall){
                responseToShow.responseChanged = true;
                prev.changed = true;
                console.log("Sending middleware response >>>");
            }

            props.immediate = false;
            prev.firstCall = false;
            prev.reqData = reqData;

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