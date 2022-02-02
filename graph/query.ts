import express, {Express} from "express"
import * as bodyParser from "body-parser"
import fileUpload from "express-fileupload";
import cors from "cors"

import Controller from "./controller";
import {Request, Response} from "../index";
import {Sequelize} from "sequelize";
import {Model} from "@avanda/orm";
import Datum from "../types/Datum";
import Service from "../types/Service";
import Filters from "../types/Filters";
import {snakeCase,omit,isPlainObject} from "lodash";
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
    corsRejected?: boolean = true;
    connection: Promise<Sequelize> | Sequelize;
    models: {[model: string]: any} = {}
    controllers: {[model: string]: typeof Controller} = {}
    serverConfig: serverConfig

    constructor(serverConfig: serverConfig) {
        this.serverConfig = serverConfig
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

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(cors({
            credentials: true,
            origin:(origin, callback) => {
                if (!origin || this.serverConfig.CORSWhitelist.indexOf(origin) !== -1) {
                    this.corsRejected = false
                    callback(null, true)
                } else {
                    this.corsRejected = true
                    callback(null, true)
                }
            }

        }));
        this.app.use(fileUpload({
            useTempFiles: true
        }));
        this.app.use(express.static('public'))

        this.app.all(this.path, async (req: express.Request, res: express.Response) => {
            let query = req.query.query as string;
            if (this.corsRejected){
                res.json({
                    msg: null,
                    data: null,
                    status_code: 500,
                    totalPages: 0
                })
                return;
            }else if (query) {
                query = JSON.parse(query);
                if (query) {
                    let response = await this.generateResponse(
                        (query as unknown as Service),
                        req,
                        res
                    )
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, Origin, Authorization')
                    if (response instanceof Response) {
                        res.status(parseInt(response.status_code as unknown as string))
                        res.json({
                            msg: response.message,
                            data: response.data,
                            status_code: response.status_code,
                            totalPages: response.currentPage,
                            ...(response.totalPages && {totalPages: response.totalPages})
                        })
                        return;
                    } else {
                        res.json({
                            msg: 'Auto-generated message',
                            data: response,
                            status_code: 200,
                            totalPages: response.currentPage,
                            ...(response.totalPages && {totalPages: response.totalPages})
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
            throw new Error('Execute before you listen')

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
        rootService: Service,
        toExclude: string[]
    ): Promise<any[] | Datum<any>> {

        let ret: any[] | Datum<any> = []

        if (Array.isArray(data)) {
            for (let index in data) {
                let datum: Datum<any> | any;
                if (isPlainObject(data[index])) {
                    if (!datum)
                        datum = {};

                    if (columns.length){
                        for (let col of columns) {
                            if (typeof col == 'string' || (col.t && col.t == 'c')) {
                                col = typeof col == 'string' ? col : col.n;
                                //
                                if (toExclude?.includes?.(col.trim()))
                                    continue;

                                    // if (this)
                                data[index] = JSON.parse(JSON.stringify(data[index]))

                                if (col in data[index]) {
                                    datum[col] = data[index][col]
                                }
                            } else {
                                let service = col;
                                col = col.a ? col.a : col.n.toLowerCase()
                                datum[col] = await this.generateResponse(service, req, res, false,data[index],rootService)
                                //    await this.generateResponse(service, req, res,false)
                                //    process the sub-service here
                            }

                        }
                    }
                    else{
                    //    return all data if no column was specified
                        datum = omit(data[index],toExclude ?? []);
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

                        if (toExclude?.includes?.(column.trim()))
                            continue;

                        datum[column] = data[column] ?? null
                    } else {
                        datum[service.a ? service.a : service.n.toLowerCase()] = await this.generateResponse(service, req, res, false, data, rootService)
                    }
                }
            }else{
                if (isPlainObject(data))
                    datum = omit(data,toExclude ?? [])
                else
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
        let data: Datum<any> | null = null;
        if (!(name in this.controllers)) {
            throw new Error('Invalid controller name: ' + name)
        }

        let controller = new this.controllers[name](await this.connection)
        let toExclude = controller?.exclude

        let controllerResponse = await this.getServiceFncResponse(
            controller,
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


        if (children && controllerData) {//
            data = await this.extractNeededDataFromArray(
                JSON.parse(JSON.stringify(controllerData, null, 2)),
                children,
                req,
                res,
                query,
                toExclude
            );
            //
        }

        if (isRoot && controllerResponse instanceof Response) {
            controllerResponse.data = data;
            return controllerResponse;
        }
        return data;
    }

    private async getServiceFncResponse(
        controller: Controller,
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
        let request = new Request()
        request.method = req.method
        request.data = req.body
        request.files = req.files
        request.args = parentData
        request.headers = req.headers
        request.params = service.pr
        request.page = service.p

        let filters = {}

        if (this.models && (serviceName in this.models)){

            model = new this.models[serviceName](await this.connection);

            if (this.autoLink && parentData) {//auto-link enabled
                //find secondary key in parent data

                let parent_key = snakeCase(parentService.n) + '_id'
                let self_key = snakeCase(serviceName) + '_id'
                if (typeof parentData[self_key] != 'undefined'){
                //    parent has 1 to 1 relationship
                    model.where({id: parentData[self_key]})
                }else{
                    // Parent has 1 to many relationship
                    if (typeof parentData['id'] == 'undefined'){
                        throw new Error(`${parentService.n} does not return property "id" to link ${service.n}'s secondary key ${parent_key} with`)
                    }
                    model.where({[parent_key]: parentData['id']})
                }
            }

            if (service.ft){
                //apply filters
                model = Query.bindFilters(model,service.ft)
            }
        }
        //set the model
        controller.model = model

        if (typeof controller[fnc] != 'function')
            throw new Error(`function \`${fnc}\` does not exist in ${serviceName}`)

        return await controller[fnc](new Response(), request);
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
                model.where({[key]: value});
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