import {Middleware} from "./index";
import Response from "../response";
import Request from "../request";
import {Model} from "@avanda/orm";

export default async function (middlewares: Middleware[], res: Response, req: Request, model: Model): Promise<Response|null>{
    for (let index in middlewares){
        let middleware = middlewares[index];

        if (typeof middleware.boot != 'undefined'){
            let boot = await middleware.boot(res,req,model)

            if (boot instanceof Response){
                boot.isMiddlewareRes = true;
                return boot;
            }else if(boot === false){
                let newRes = new Response();
                newRes.isMiddlewareRes = true;
                return newRes.error(`${index} failed but has no onFailure method response`)
            }
            continue;
        }else if (typeof middleware.validate == 'function'  && !await middleware.validate(req)){

            if (typeof middleware.onFailure == 'function'){
                let middlewareResponse = middleware.onFailure(res,req);

                if (middlewareResponse.statusCode < 300)
                    middlewareResponse.statusCode = 401;

                middlewareResponse.isMiddlewareRes = true;

                return middlewareResponse;
            }else{
                let newRes = new Response();
                newRes.isMiddlewareRes = true;
                return newRes.error(`${index} failed but has no onFailure method response`)
            }

        }
    }
    return null
}