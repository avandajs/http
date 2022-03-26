import WatchContext from "./WatchContext";
import {Middleware} from "../middleware";
import Request from "../request";

export default interface WatchableProps {
    watch: (request: Request) => any | Promise<any>,
    middlewares?: Middleware[],
    immediate?: boolean
}