import Response from "../response";
import Request from "../request";

export default interface Middleware {
    validate: (res: Response, req: Request) => boolean;
    onFailure: (res: Response,req: Request) => Response;
}