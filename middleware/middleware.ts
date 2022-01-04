import Response from "../response";
import Request from "../request";

export default interface Middleware {

    validate?: (req: Request) => boolean | Promise<boolean>;
    boot?: (res: Response, req: Request) => Promise<boolean|Response> | boolean | Response;
    onFailure?: (res: Response,req: Request) => Response;
}