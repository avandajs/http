import {Middleware} from "./index";
import Response from "../response";
import Request from "../request";

export default function (middlewares: Middleware[], res: Response, req: Request): Response|null{
    for (let index in middlewares){
        let middleware = middlewares[index];

        if (typeof middleware.boot == 'function'){
            let boot = middleware.boot(res,req)

            if (boot instanceof Response){
                return boot;
            }
            return null
        }

        if (typeof middleware.validate == 'function'  && !middleware.validate(req)){

            if (typeof middleware.onFailure == 'function'){
                let middlewareResponse = middleware.onFailure(res,req);

                if (middlewareResponse.status_code < 300)
                    middlewareResponse.status_code = 401;

                return middlewareResponse;
            }else{
                return (new Response()).error(`${index} failed but has no onFailure method response`)
            }

        }
    }
    return null
}