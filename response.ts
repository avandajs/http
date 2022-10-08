import { Model } from "@avanda/orm";
import Query from "./graph/query";
import AvandaWebSocket from "./types/AvandaWebSocket";
import Request from "./request";
import Datum from "./types/Datum";

export default class Response{
    statusCode: number = 0
    data: any;
    currentPage: number;
    totalPages: number;
    responseChanged: boolean = false;
    isMiddlewareRes: boolean = false
    perPage: number = 0;
    headers: Datum<any>;
    message?: string;
    model?: Model
    wsCLient?: AvandaWebSocket
    constructor() {

    }

    status(code: number){
        this.statusCode = code
    }



    json(data: any[]){
        
    }

    success<ResponseDataType>(msg: string, data: ResponseDataType | null = null,code: number = 200): Response{
        this.statusCode = code
        this.data = data
        this.message = msg;
        return this
    }

    sendResponseAsWsMessage(response: this){
        if(this.wsCLient) this.wsCLient.send(JSON.stringify(Query.responseToObject(response)))
        return this;
    }

    error<ResponseDataType>(msg: string, code: number = 401, data: ResponseDataType | null = null): Response{
        this.statusCode = 400
        this.data = data
        this.message = msg;
        return this
    }

    async pagedData(request: Request,msg?: string) {
        let data = await request.model.page(request.page,true)
        //@ts-ignore
        this.totalPages = request.model.totalPages;
        this.currentPage = request.page
        // @ts-ignore
        this.perPage = request.model.perPage;
        return this.success(msg ?? 'Data fetched',data)
    }

    async singleData(){
        return (await this.model?.first())
    }

    async allData(){
        return (await this.model?.all())
    }


}