import Response from "../response";
import Request from "../request";
import {Model} from "@avanda/orm";

export default interface Middleware {
    args?: any;
    validate?: (req: Request) => boolean | Promise<boolean>;
    boot?: (res: Response, req: Request, model?: Model) => Promise<boolean|Response> | boolean | Response;
    onFailure?: (res: Response,req: Request) => Response;
}