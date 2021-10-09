import {Middleware} from "./index";
import Response from "../response";
import Request from "../request";

export default function (middlewares: Middleware[], res: Response, req: Request): Response|null{
    for (let index in middlewares){
        let middleware = middlewares[index];

        if (!middleware.validate(res,req)){
            let middlewareResponse = middleware.onFailure(res,req);

            if (middlewareResponse.status_code < 300)
                middlewareResponse.status_code = 401;

            return middlewareResponse;
        }
    }
    return null
}