import WatchContext from "./WatchContext";
import {Middleware} from "../middleware";

export default interface WatchableProps {
    watch: (context: WatchContext) => any,
    middlewares?: Middleware[]
}