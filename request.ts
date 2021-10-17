import express from "express";
import Datum from "./types/Datum";
import {Schema} from "@avanda/app"
import {UploadedFile} from "express-fileupload";
import Joi from "joi";
import Response from "./response";

type Rules = {
    [key: string]: Joi.AnySchema
}

export default class Request{
    method: string;
    args?: Datum<any>
    params?: Datum<any>
    data?: Datum<any>
    files?:  {[index: string]: UploadedFile | UploadedFile[]}
    query?: Datum<any>
    columns?: Datum<any>
    constructor(expressReq: express.Request,expressRes: express.Response) {
        this.method = expressReq.method;
        // this.data = expressReq.
    }
    getFiles(key: string): UploadedFile | UploadedFile[] | undefined{
        return this.files?.[key]
    }
    getFile(key: string): UploadedFile | undefined{
        let files = this.files?.[key];
        if (Array.isArray(files))
            return files[0]
        else
            return files
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
    validate(schemaRules: (schema: Joi.Root) => Rules){
        let schema =  (new Schema(schemaRules)).validate(this.data)

        if (Object.keys(schema).length > 0){
            return (new Response()).error('Invalid input',400,schema)
        }
        return true
    }
}