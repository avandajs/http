import Datum from "./types/Datum";

export default class Response{
    status_code: number = 0
    data: any;
    currentPage: number;
    totalPages: number;
    headers: Datum<any>;
    message?: string;
    constructor() {

    }

    status(code: number){
        this.status_code = code
    }

    json(data: any[]){
        
    }

    success<ResponseDataType>(msg: string, data: ResponseDataType | null = null,code: number = 200): Response{
        this.status_code = code
        this.data = data
        this.message = msg;
        return this
    }

    error<ResponseDataType>(msg: string, code: number = 401, data: ResponseDataType | null = null): Response{
        this.status_code = 400
        this.data = data
        this.message = msg;
        return this
    }

}