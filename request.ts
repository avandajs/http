import express from "express";
import Datum from "./types/Datum";
import {Validator} from "@avanda/app"
import Response from "./response";
import axios, {AxiosResponse} from "axios";
import UploadedFile from "./types/UploadedFile";


export default class Request{
    method: string;
    id: string | number;
    page: number;
    args?: Datum<any>
    attrs?: Datum<any> = {}
    params?: Datum<any>
    data?: Datum<any>
    files?:  {[index: string]: UploadedFile | UploadedFile[]}
    query?: Datum<any>
    columns?: Datum<any>
    headers?: Datum<any>

    constructor() {
    }
    getFiles(key: string): UploadedFile[] | undefined{
        let files = this.files?.[key];

        if (!Array.isArray(files))
            return [files]

        return files
    }
    getFile(key: string): UploadedFile | undefined{
        let files = this.files?.[key];
        if (Array.isArray(files))
            return files[0]
        else
            return files
    }
    getData<R>(key: string): R | null{
        return key ? (this.data?.[key] ?? null) : null
    }
    setData(data: Datum<any>): this{
        this.data = data
        return this;
    }
    setHeaders(headers: Datum<any>): this{
        this.headers = headers
        return this;
    }
    setQuery(query: Datum<any>): this{
        this.query = query
        return this;
    }
    setAttr<T = any>(attr: string, value: T): this{
        this.attrs[attr] = value
        return this;
    }
    setAttrs<T = any>(attrs: Datum<any>): this{
        this.attrs = attrs
        return this;
    }

    getHeader<R>(key?: string): R | null{
        return key ? (this.headers?.[key] ?? null) : null
    }
    getArgs<R>(key?: string): R | null{
        return key ? (this.args?.[key] ?? null) : null
    }
    getAttrs<R>(key?: string): R | null{
        return key ? (this.attrs?.[key] ?? null) : null
    }
    getParams<R>(key?: string): R | null{
        return key ? (this.params?.[key] ?? null) : null
    }

    async validate(schemaRules: (rule: typeof Validator.Rule) => {[k: string]: Validator.Rule}){
        let schema =  (new Validator.Schema(schemaRules(Validator.Rule)))
        let result = await schema.validate(this.data)

        if (Object.keys(result).length > 0){
            return (new Response()).error('Invalid input',400,result)
        }
        return true
    }

    async get(url: string): Promise<Response>{
        return await this.makeRequest(url,async (url) => await axios.get(url,{
            headers: this.headers
        }))
    }

    async post(url: string, data?: Datum<any>): Promise<Response>{
        return await this.makeRequest(url,async (url) => await axios.post(url, data ?? this.data ?? {}, {
            headers: this.headers
        }))
    }
    async patch(url: string, data?: Datum<any>): Promise<Response>{
        return await this.makeRequest(url,async (url) => await axios.patch(url, data ?? this.data ?? {}, {
            headers: this.headers
        }))
    }
    async put(url: string, data?: Datum<any>): Promise<Response>{
        return await this.makeRequest(url,async (url) => await axios.put(url, data ?? this.data ?? {}, {
            headers: this.headers
        }))
    }

    async makeRequest(url: string,request: (url) => Promise<AxiosResponse>): Promise<Response>{

        try {
            let queryString = this.query ?  new URLSearchParams(this.query).toString() : ''

            if (queryString.length)
                url +='?'+queryString


            let axiosRes = await request(url);
            let status = axiosRes.status
            let headers = axiosRes.headers

            let response = new Response();
            response.headers = headers;
            response.statusCode = status;
            response.data = axiosRes.data;
            return response
        }catch (e){
            let response = new Response();

            response.headers = e.response.headers;
            response.statusCode = e.response.status;
            response.data = e.response.data;
            response.message = e.response.statusText

            return response
        }
    }
}