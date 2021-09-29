import {Middleware} from "../middleware";
import verbe from "./verb";

export default function (...middlewares: Middleware[]){
    return verbe(middlewares,'post')
}