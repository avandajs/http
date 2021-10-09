import express from "express";
import Datum from "./types/Datum";

export default class Request{
    method: string;
    args?: Datum<any>
    params?: Datum<any>
    data?: Datum<any>
    query?: Datum<any>
    columns?: Datum<any>
    constructor(expressReq: express.Request,expressRes: express.Response) {
        this.method = expressReq.method;
        // this.data = expressReq.
    }

    getData<R>(key?: string): R | Datum<any>{
        return key ? this.data?.[key] : this.data
    }
    getArgs<R>(key?: string): R | Datum<any>{
        return key ? this.args?.[key] : this.args
    }
    getParams<R>(key?: string): R | Datum<any>{
        return key ? this.params?.[key] : this.params
    }
}