import Controller from "./graph/controller";
import Response from "./response";
import Request from "./request";
import Watchable from "./verbs/watchable";
import { Model } from "@avanda/orm";

export default class Test extends Controller{

    @Watchable({
        watch: (context) => true
    })
    async get(response: Response, request: Request): Promise<any> {
        return response.singleData();
    }
}