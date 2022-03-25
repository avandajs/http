import Controller from "./graph/controller";
import Response from "./response";
import Request from "./request";
import Watchable from "./verbs/watchable";

export default class Test extends Controller{

    @Watchable({
        watch: (context) => true
    })
    async get(response: Response, request: Request): Promise<any> {
        return super.get(response, request);
    }
}