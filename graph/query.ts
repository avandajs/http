import express, {Express} from "express"
import * as bodyParser from "body-parser"

import * as Services from "../../../app/controllers/.boot"
import * as Models from "../../../app/models/.boot"
import Controller from "./controller";
import {Request, Response} from "../index";
import {Sequelize} from "sequelize";
import {runtimeError} from "@avanda/error";
import {Model} from "@avanda/orm";
import Datum from "../types/Datum";
import Service from "../types/Service";
import Filters from "../types/Filters";


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
    connection: Sequelize;

    constructor(connection: Sequelize) {
        this.connection = connection;
        return this;
    }

    async execute(path: string = '/', port: number = 8080) {

        this.port = port
        this.path = path
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.raw());
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
                        res.status(parseInt(response.status_code as unknown as string))
                        res.json({
                            msg: response.message,
                            data: response.data,
                            status_code: response.status_code,
                        })
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

        this.app.listen(this.port, () => {
            console.log(`app listening at http://localhost:${this.port}`)
        })
    }

    private async extractNeededDataFromArray(data: any[] | Datum<any>, columns: Array<string | Service>, req: express.Request, res: express.Response): Promise<any[] | Datum<any>> {
        let ret: any[] | Datum<any> = []

        console.log({data})

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
                                if (col in data[index]) {
                                    datum[col] = data[index][col]
                                }
                            } else {
                                let service = col;
                                col = col.a ? col.a : col.n.toLowerCase()
                                datum[col] = await this.generateResponse(service, req, res, false,data[index])
                                //    await this.generateResponse(service, req, res,false)
                                //    process the sub-service here
                            }

                        }
                    }
                    else{
                    //    return all data if no column was specified
                        datum = data[index];
                    }

                } else {
                    //    item in this array is not object
                    datum = data[index]
                }

                // console.log({datum})
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
                        datum[service.a ? service.a : service.n.toLowerCase()] = await this.generateResponse(service, req, res, false, data)
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
        parentData?: Datum<any>
    ): Promise<Response | any> {
        let name = query.n;
        let type = query.t;
        let children = query.c;

        let data: Datum<any> = {};
        let columns: string[] = [];
        if (!(name in Services)) {
            throw new runtimeError('Invalid controller name: ' + name)
        }

        let controllerResponse = await this.getServiceFncResponse(
            (Services as any)[name],
            req,
            res,
            name,
            query,
            parentData
        )

        if (typeof controllerResponse == 'function' && !(controllerResponse instanceof Response))
            //will be function if returned from middleware decorator
            controllerResponse = new controllerResponse()

        //

        if (!(controllerResponse instanceof Response) && isRoot)
            //convert raw returned data to response for the root
            controllerResponse = (new Response()).success<any>('', controllerResponse)

        if (isRoot && controllerResponse.status_code > 299) {//if is root, and response doesn't look success, return the root response only
            return controllerResponse;
        }
        let controllerData: any = controllerResponse instanceof Response ? controllerResponse.data : controllerResponse


        if (children) {
            data = await this.extractNeededDataFromArray(controllerData, children, req, res);
            //
        }

        if (isRoot && controllerResponse instanceof Response) {
            controllerResponse.data = data;
            return controllerResponse;
        }
        return data;
    }

    private async getServiceFncResponse(
        controller: new (connection: Sequelize,model: Model | null) => Controller,
        req: express.Request,
        res: express.Response,
        serviceName: string,
        service: Service,
        parentData?: Datum<any>
    ): Promise<Response | any> {
        // get Controller's specified function
        // initiate controller

        let fnc = service.f ? service.f:'get';
        let model: Model | null = null;
        let request = new Request(req, res)
        request.data = req.body
        request.args = parentData

        if (serviceName in Models){

            model = new (Models as any)[serviceName](this.connection) as Model;
            if (service.al) {//auto-link enabled
                //
                console.log('Auto link enabled')

                console.log({pd: JSON.stringify(parentData)})

            }
            if (service.ft){
                //apply filters
                model = Query.bindFilters(model,service.ft)
            }

        }

        let ctr = new controller(this.connection, model)

        return await (ctr as any)[fnc](new Response(), request);
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