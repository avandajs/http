import Datum from "./types/Datum";

export default class Response{
    statusCode: number = 0
    data: any;
    currentPage: number;
    totalPages: number;
    perPage: number = 0;
    headers: Datum<any>;
    message?: string;
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

    error<ResponseDataType>(msg: string, code: number = 401, data: ResponseDataType | null = null): Response{
        this.statusCode = 400
        this.data = data
        this.message = msg;
        return this
    }

}