import Response from "../response";
import Request from "../request";

export default interface Middleware {

    validate?: (req: Request) => boolean;
    boot?: (res: Response, req: Request) => boolean | Response;
    onFailure?: (res: Response,req: Request) => Response;
}