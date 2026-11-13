import { Middleware } from "../middleware";

export default interface StreamableProps {
    middlewares?: Middleware[],
    // bytes; a larger frame closes the socket with 1009
    maxPayload?: number
}
