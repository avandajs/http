import WatchableProps from "../types/WatchableProps";
import Request from "../request";
import Response from "../response";
import validate from "../middleware/validate";

export default function (props: WatchableProps): any{
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {

        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any) {
            let request = args[1] as Request
            let response = args[0] as Response

            //check for middlewares validity
            let middlewareCheck = await validate(props.middlewares,response,request)
            if (middlewareCheck !== null){
                return function (...args: any){
                    return middlewareCheck
                }
            }
            // console.log({args})
            //ignore next line
            Object.defineProperty(this,'request_method',{value: 'get'})

            return originalMethod.apply(this, args);
        };

        return descriptor;
    }
}