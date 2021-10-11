import express, {Express} from "express"
import * as bodyParser from "body-parser"
import cors from "cors"

import Controller from "./controller";
import {Request, Response} from "../index";
import {Sequelize} from "sequelize";
import {runtimeError} from "@avanda/error";
import {Model} from "@avanda/orm";
import Datum from "../types/Datum";
import Service from "../types/Service";
import Filters from "../types/Filters";
import {snakeCase} from "lodash";
import {serverConfig} from "@avanda/app";

/*
 *
 * The keys in the json/Service objects
 * are kept single letter to
 * make request URL as
 * short as possible
 *
 * */



export default class Query {
    app: Express = express();
    port: number = 8080;
    path: string = '/';
    autoLink?: boolean;
    connection: Promise<Sequelize> | Sequelize;
    models: {[model: string]: any} = {}
    controllers: {[model: string]: any} = {}

    constructor(serverConfig: serverConfig) {
        this.connection = serverConfig.connection;
        this.port = parseInt(serverConfig.port as string)
        this.path = serverConfig.rootPath
        return this;
    }

    async execute(
        models: {[k: string]: any},
        controllers: {[k: string]: any},
        ): Promise<this> {
        this.models = models
        this.controllers = controllers

        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.raw());

        this.app.use(cors({
            origin: function(origin, callback){
                if(!origin) return callback(null, true);
                return callback(null, true);
            }

        }));

        this.app.all(this.path, async (req: express.Request, res: express.Response) => {
            let query = req.query.query as string;
            if (query) {
                query = JSON.parse(query);
                if (query) {
                    let response = await this.generateResponse(
                        (query as unknown as Service),
                        req,
                        res
                    )
                    if (response instanceof Response) {
                        res.status(parseInt(response.status_code as unknown as string)).json({
                            msg: response.message,
                            data: response.data,
                            status_code: response.status_code,
                        })
                        return;
                    } else {
                        res.json({
                            msg: 'Auto-generated message',
                            data: response,
                            status_code: 200,
                        })
                    }
                    return;
                }
            }
            res.send('Hello World!')
        })

        return this
    }

    public getServerInstance(): Express{
        return this.app
    }

    public listen(){

        if (!this.app)
            throw new runtimeError('Execute before you listen')

        this.app.listen(this.port, () => {
            console.log(`app listening at http://localhost:${this.port}`)
        })

        return this.app
    }

    private async extractNeededDataFromArray(
        data: any[] | Datum<any>,
        columns: Array<string | Service>,
        req: express.Request,
        res: express.Response,
        rootService: Service
    ): Promise<any[] | Datum<any>> {

        let ret: any[] | Datum<any> = []

        if (Array.isArray(data)) {
            for (let index in data) {
                let datum: Datum<any> | any;
                if (data[index] instanceof Object && !Array.isArray(data[index]) && data[index] !== null) {

                    if (!datum)
                        datum = {};

                    if (columns.length){
                        for (let col of columns) {

                            if (typeof col == 'string' || (col.t && col.t == 'c')) {
                                col = typeof col == 'string' ? col : col.n;
                                data[index] = JSON.parse(JSON.stringify(data[index]))

                                if (col in data[index]) {
                                    datum[col] = data[index][col]
                                }
                            } else {
                                let service = col;
                                col = col.a ? col.a : col.n.toLowerCase()
                                console.log({col,service,di: data[index]})
                                datum[col] = await this.generateResponse(service, req, res, false,data[index],rootService)
                                //    await this.generateResponse(service, req, res,false)
                                //    process the sub-service here
                            }

                        }
                    }
                    else{
                    //    return all data if no column was specified
                        datum = data[index];
                    }

                }
                else {
                    //    item in this array is not object
                    datum = data[index]
                }

                ret.push(datum)
            }
        }
        else {
            let datum: Datum<any> = {}
            if (columns.length){
                for (const service of columns) {
                    if (typeof service == 'string' || (service.t && service.t === 'c')) {
                        let column = typeof service == 'string' ? service : service.n;
                        datum[column] = data ? (data[column] || null) : null;
                    } else {
                        datum[service.a ? service.a : service.n.toLowerCase()] = await this.generateResponse(service, req, res, false, data, rootService)
                    }
                }
            }else{
                datum = data
            }
            ret = datum;
        }

        return ret
    }

    private async generateResponse(
        query: Service,
        req: express.Request,
        res: express.Response,
        isRoot: boolean = true,
        parentData?: Datum<any>,
        parentService?: Service
    ): Promise<Response | any> {

        let name = query.n;
        let type = query.t;
        let children = query.c;

        if (isRoot){//get root autolink state
            this.autoLink = query.al;
        }
        let data: Datum<any> = {};
        let columns: string[] = [];
        if (!(name in this.controllers)) {
            throw new runtimeError('Invalid controller name: ' + name)
        }

        let controllerResponse = await this.getServiceFncResponse(
            this.controllers[name],
            req,
            res,
            name,
            query,
            parentData,
            parentService
        )

        if (typeof controllerResponse == 'function' && !(controllerResponse instanceof Response))
            //will be function if returned from middleware decorator
            controllerResponse = await new controllerResponse()

        //

        if (!(controllerResponse instanceof Response) && isRoot) {
            //convert raw returned data to response for the root
            controllerResponse = await (new Response()).success<any>('', controllerResponse)
        }

        if (isRoot && controllerResponse.status_code > 299) {//if is root, and response doesn't look success, return the root response only
            return controllerResponse;
        }
        let controllerData: any = controllerResponse instanceof Response ? await controllerResponse.data : await controllerResponse


        console.log({controllerData})


        if (children) {
            data = await this.extractNeededDataFromArray(controllerData, children, req, res, query);
            //
        }

        if (isRoot && controllerResponse instanceof Response) {
            controllerResponse.data = data;
            return controllerResponse;
        }
        console.log({data})
        return data;
    }

    private async getServiceFncResponse(
        controller: new (connection: Sequelize,model: Model | null) => Controller,
        req: express.Request,
        res: express.Response,
        serviceName: string,
        service: Service,
        parentData?: Datum<any>,
        parentService?: Service,
    ): Promise<Response | any> {
        // get Controller's specified function
        // initiate controller

        let fnc = service.f ? service.f:'get';
        let model: Model | null = null;
        let request = new Request(req, res)
        request.data = req.body
        request.args = parentData

        if (this.models && (serviceName in this.models)){

            model = new this.models[serviceName](await this.connection);

            console.log({autoLink: this.autoLink})

            if (this.autoLink && parentData) {//auto-link enabled
                //find secondary key in parent data

                let sec_key = snakeCase(parentService.n) + '_id'

                if (typeof parentData[sec_key] != 'undefined'){
                //    parent has 1 to 1 relationship
                    model.where({id: parentData[sec_key]})
                }else{
                    // Parent has 1 to many relationship
                    if (typeof parentData['id'] == 'undefined'){
                        throw new runtimeError(`${parentService.n} does not return property "id" to link ${service.n}'s secondary key ${sec_key} with`)
                    }
                    model.where({[sec_key]: parentData['id']})
                }
            }

            if (service.ft){
                //apply filters
                model = Query.bindFilters(model,service.ft)
            }
        }

        return await new controller(await this.connection, model)[fnc](new Response(), request);
    }

    private static bindFilters(model: Model, filters: Filters): Model {
        let operators: {[k: string]: (key: string, value: any, model: Model) => void}
        operators = {
            ">": (key: string, value: any, model: Model) => {
                model.whereRaw(`${key} > ${value}`);
            },
            "<": (key: string, value: any, model: Model) => {
                model.whereRaw(`${key} < ${value}`);
            },
            "==": (key: string, value: any, model: Model) => {
                model.whereRaw(`${key} = ${value}`);
            },
            "=": (key: string, value: any, model: Model) => {
                operators['=='](key,value,model)
            },
            "!=": (key: string, value: any, model: Model) => {
                model.whereRaw(`${key} != ${value}`);
            },
            "NULL": (key: string, value: any, model: Model) => {
                model.whereColIsNull<string>(key);
            },
            "NOTNULL": (key: string, value: any, model: Model) => {
                model.whereColIsNotNull<string>(key);
            },
            "MATCHES": (key: string, value: any, model: Model) => {
                model.whereColumns(key).matches(value);
            },
            "LIKES": (key: string, value: any, model: Model) => {
                model.where(key).like(`%${value}%`);
            },
            "NOT": (key: string, value: any, model: Model) => {
                model.where(key).notLike("%$value%");
            }
        }
        for (let key in filters) {
            let filter = filters[key];
            let value = filter.vl ?? null;
            let operator = filter.op;

            operators[operator](key, value, model);
        }

        return model
    }
}