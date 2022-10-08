import WatchContext from "./WatchContext";
import {Middleware} from "../middleware";
import Request from "../request";
import { Broadcastable } from "../graph/event";

export default interface WatchableProps {
    watch?: (request: Request) => any | Promise<any>,
    interval?: number,
    middlewares?: Middleware[],
    immediate?: boolean,
    event?: string | ((req: Request) =>  Broadcastable)
}