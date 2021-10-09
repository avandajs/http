import {Middleware} from "../middleware";
import verb from "./verb";

export default function (...middlewares: Middleware[]): any{
    return verb(middlewares,'option')
}