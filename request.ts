import express from "express";
import Datum from "./types/Datum";
import { Validator } from "@avanda/app";
import Response from "./response";
import axios, { AxiosResponse } from "axios";
import UploadedFile from "./types/UploadedFile";
import { Model } from "@avanda/orm";
import Service from "./types/Service";
import AvandaHttpRequest from "./types/AvandaHttpRequest";
import Controller from "./graph/controller";
import AvandaWebSocket from "./types/AvandaWebSocket";
import { Sequelize } from "sequelize";
import Query from "./graph/query";
import { isPlainObject, omit, snakeCase } from "lodash";
import cache from "global-cache";
export default class Request {
  method: string;
  id: string | number;
  page: number;
  isWatcher: boolean = false;
  args?: Datum<any>;
  parent?: Datum<any>;
  attrs?: Datum<any> = {};
  eventPayload?: Datum<any> = {};
  params?: Datum<any>;
  data?: Datum<any>;
  files?: { [index: string]: UploadedFile | UploadedFile[] };
  query?: Datum<any>;
  columns?: Datum<any>;
  caches: Datum<any> = {};
  headers?: Datum<any> = {};
  model?: Model;
  service?: Service;
  controllers: { [model: string]: typeof Controller } = {};
  models: { [model: string]: any } = {};
  connection: Promise<Sequelize> | Sequelize;
  expressReq: AvandaHttpRequest;
  timeout?: number;
  expressRes: express.Response;
  executeWatchable: boolean = true;
  onClosedCallback?: () => void;

  constructor() {}

  private async getController(query: Service): Promise<Controller> {
    let name = query.n;
    return new this.controllers[name](await this.connection);
  }

  setTimeOut(milliseconds: number){
    this.timeout = milliseconds;
  }

  private async extractNeededDataFromArray(
    data: any[] | Datum<any>,
    columns: Array<string | Service>,
    rootService: Service,
    toExclude: string[],
    _for: "watcher" | "graph"
  ): Promise<any[] | Datum<any>> {
    let ret: any[] | Datum<any> = [];

    if (Array.isArray(data)) {
      for (let index in data) {
        let datum: Datum<any> | any;
        if (isPlainObject(data[index])) {
          if (!datum) datum = {};

          if (columns.length) {
            data[index] = JSON.parse(JSON.stringify(data[index]));
            let selectAll = columns.includes("*");
            if (selectAll) {
              datum = omit(data[index], toExclude ?? []);
            }
            for (let col of columns) {
              if (
                typeof col == "string" ||
                (col.t && col.t == "c" && !selectAll)
              ) {
                col = typeof col == "string" ? col : col.n;

                if (toExclude?.includes?.(col.trim())) continue;

                if (col in data[index]) {
                  datum[col] = data[index][col];
                }
              } else {
                let service = col;
                col = col.a ? col.a : snakeCase(col.n);
                let cache_key = null;

                let funcResponse = await this.generateResponseFromGraph(
                  false,
                  service,
                  false,
                  {
                    ...data[index],
                    ...datum,
                  },
                  rootService,
                  undefined,
                  _for
                );

                datum[col] = funcResponse;

                // catche;
                //    await this.generateResponse(service, req, res,false)
                //    process the sub-service here
              }
            }
          } else {
            //    return all data if no column was specified
            datum = omit(data[index], toExclude ?? []);
          }
        } else {
          //    item in this array is not object
          datum = data[index];
        }

        ret.push(datum);
      }
    } else {
      let datum: Datum<any> = {};

      if (columns.length) {
        let selectAll = columns.includes("*");

        if (selectAll) {
          datum = omit(data, toExclude ?? []);
        }
        for (const service of columns) {
          if (
            typeof service == "string" ||
            (service.t && service.t === "c" && !selectAll)
          ) {
            let column = typeof service == "string" ? service : service.n;
            if (toExclude?.includes?.(column.trim())) continue;

            datum[column] = data[column] ?? null;
          } else {
            datum[service.a ? service.a : service.n.toLowerCase()] =
              await this.generateResponseFromGraph(
                false,
                service,
                false,
                { ...data, ...datum },
                rootService,
                undefined,
                _for
              );
          }
        }
      } else {
        if (isPlainObject(data)) datum = omit(data, toExclude ?? []);
        else datum = data;
      }
      ret = datum;
    }

    return ret;
  }

  private async getServiceFncResponse(
    controller: Controller,
    serviceName: string,
    service: Service,
    parentData?: Datum<any>,
    parentService?: Service,
    isWatcher?: boolean,
    wsClient?: AvandaWebSocket
  ): Promise<Response | any> {
    // get Controller's specified function
    // initiate controller

    let fnc = service.f ? service.f : "get";
    let model: Model | null = null;
    this.method = this.expressReq.method ?? "GET";
    this.data = this.expressReq.body;
    this.files = this.expressReq.files;
    this.args = parentData;
    this.parent = parentData;
    this.headers = this.expressReq.headers;
    this.params = service.pr;
    this.page = service.p;
    this.id = this.expressReq.requestId;
    this.isWatcher = isWatcher;
    let cacheResponse = true;

    // request.attrs

    let filters = {};
    let cache_key = null;

    if (this.models?.hasOwnProperty(serviceName)) {
      model = new this.models[serviceName](await this.connection);
      // model.
      if (service.al) {
        let parent_key = parentService
          ? snakeCase(parentService.n) + "_id"
          : null;
        let self_key = snakeCase(serviceName) + "_id";

        if (parentData && (parentData as Object).hasOwnProperty(self_key)) {
          //    parent has 1 to 1 relationship
          if (parentData[self_key]) {
            model.where({ id: parentData[self_key] });
            cache_key = serviceName + "/" + fnc + "_" + "id" + "_" + parentData[self_key];
          }
        } else if (parentData && typeof parentData == "object") {
          // Parent has 1 to many relationship
          if (typeof parentData["id"] != "undefined" && parentData["id"]) {
            model.where({ [parent_key]: parentData["id"] });
            cache_key =
              serviceName +
              "/" +
              fnc +
              "_" +
              parent_key +
              "_" +
              parentData["id"];
          }
        }
      }

      if (service.ft) {
        //apply filters
        model = Query.bindFilters(model, service.ft);
      }
    }

    // if (cacheResponse && cache_key && this.caches.hasOwnProperty(cache_key)) {
    //   console.log("fnc from caceh>> ", { cache_key });
    //   return this.caches[cache_key];
    // }

    let response = new Response();
    //set the model
    controller.model = model;
    this.model = model;
    response.model = model;
    response.wsCLient = wsClient;

    if (typeof controller[fnc] != "function")
      throw new Error(`function \`${fnc}\` does not exist in ${serviceName}`);

    let fncResponse = await controller[fnc](response, this, controller.model);
    // if (cacheResponse && cache_key) {
    //   this.caches[cache_key] = fncResponse;
    //   console.log("caching response >> ", { cache_key });
    // }
    return fncResponse;
  }

  async generateResponseFromGraph(
    executeWatchable: boolean = false,
    query: Service | null = null,
    isRoot: boolean = true,
    parentData?: Datum<any>,
    parentService?: Service,
    _controller?: Controller,
    _for: "watcher" | "graph" = "graph",
    wsCLient?: AvandaWebSocket
  ): Promise<Response | any> {
    let service = query ?? this.service;
    this.executeWatchable = executeWatchable;
    // console.log({service})
    let name = service.n;
    let type = service.t;
    let children = service.c;

    let data: Datum<any> | null = null;
    if (!(name in this.controllers)) {
      throw new Error("Invalid controller name: " + name);
    }

    let controller = _controller ?? (await this.getController(service));
    let toExclude = controller?.exclude;

    let controllerResponse = await this.getServiceFncResponse(
      controller,
      name,
      service,
      parentData,
      parentService,
      _for === "watcher",
      wsCLient
    );

    if (
      typeof controllerResponse == "function" &&
      !(controllerResponse instanceof Response)
    )
      //will be function if returned from middleware decorator
      controllerResponse = await new controllerResponse();

    //

    if (!(controllerResponse instanceof Response) && isRoot) {
      //convert raw returned data to response for the root
      controllerResponse = await new Response().success<any>(
        "",
        controllerResponse
      );
    }

    if (isRoot && controllerResponse.status_code > 299) {
      //if is root, and response doesn't look success, return the root response only
      this.executeWatchable = true;
      return controllerResponse;
    }

    // // Stop deep nesting if response didn't change
    // if (controllerResponse instanceof Response && _for == 'watcher' && !controllerResponse.responseChanged && isRoot){
    //     return  controllerResponse;
    // }

    let controllerData: any =
      controllerResponse instanceof Response
        ? await controllerResponse.data
        : await controllerResponse;

    if (children && controllerData) {
      //
      data = await this.extractNeededDataFromArray(
        JSON.parse(JSON.stringify(controllerData, null, 2)),
        children,
        service,
        toExclude,
        _for
      );
      //
    }

    if (isRoot && controllerResponse instanceof Response) {
      controllerResponse.data = data;
      this.executeWatchable = true;
      return controllerResponse;
    }
    this.executeWatchable = true;
    return data;
  }

  getFiles(key: string): UploadedFile[] | undefined {
    let files = this.files?.[key];

    if (!Array.isArray(files)) return [files];

    return files;
  }
  getFile(key: string): UploadedFile | undefined {
    let files = this.files?.[key];
    if (Array.isArray(files)) return files[0];
    else return files;
  }
  getData<R>(key: string): R | null {
    return key ? this.data?.[key] ?? null : null;
  }
  getObjectData<R>(key: string): R | undefined {
    try{
      if(!this.data || !this.data[key]) return null;
      return JSON.parse(this.data[key]) as R
    } catch(e){
      return null;
    }
  }
  setData(data: Datum<any>): this {
    this.data = data;
    return this;
  }
  setHeaders(headers: Datum<any>): this {
    this.headers = headers;
    return this;
  }
  setQuery(query: Datum<any>): this {
    this.query = query;
    return this;
  }
  setAttr<T = any>(attr: string, value: T): this {
    this.attrs[attr] = value;
    return this;
  }
  setAttrs<T = any>(attrs: Datum<any>): this {
    this.attrs = attrs;
    return this;
  }
  setPayload<T = any>(payload: Datum<any>): this {
    this.eventPayload = payload;
    return this;
  }

  getPayload<R>(): R | null {
    return this.eventPayload as R;
  }

  getHeader<R>(key?: string): R | null {
    return key ? this.headers?.[key] ?? null : null;
  }
  getArgs<R>(key?: string): R | null {
    return key ? this.args?.[key] ?? null : null;
  }
  getAttrs<R>(key?: string): R | null {
    return key ? this.attrs?.[key] ?? null : null;
  }
  getParams<R>(key?: string): R | null {
    return key ? this.params?.[key] ?? null : null;
  }

  async validate(
    schemaRules: (rule: typeof Validator.Rule) => {
      [k: string]: Validator.Rule;
    }
  ) {
    let schema = new Validator.Schema(schemaRules(Validator.Rule));
    let result = await schema.validate(this.data);

    if (Object.keys(result).length > 0) {
      return new Response().error("Invalid input", 400, result);
    }
    return true;
  }

  async get(url: string): Promise<Response> {
    return await this.makeRequest(
      url,
      async (url) =>
        await axios.get(url, {
          headers: this.headers,
          timeout: this.timeout
        })
    );
  }

  async post(url: string, data?: Datum<any>): Promise<Response> {
    return await this.makeRequest(
      url,
      async (url) =>
        await axios.post(url, data ?? this.data ?? {}, {
          headers: this.headers,
          timeout: this.timeout
        })
    );
  }
  async patch(url: string, data?: Datum<any>): Promise<Response> {
    return await this.makeRequest(
      url,
      async (url) =>
        await axios.patch(url, data ?? this.data ?? {}, {
          headers: this.headers,
          timeout: this.timeout
        })
    );
  }
  async put(url: string, data?: Datum<any>): Promise<Response> {
    return await this.makeRequest(
      url,
      async (url) =>
        await axios.put(url, data ?? this.data ?? {}, {
          headers: this.headers,
          timeout: this.timeout
        })
    );
  }

  async makeRequest(
    url: string,
    request: (url) => Promise<AxiosResponse>
  ): Promise<Response> {
    try {
      let queryString = this.query
        ? new URLSearchParams(this.query).toString()
        : "";

      if (queryString.length) url += "?" + queryString;

      let axiosRes = await request(url);
      let status = axiosRes.status;
      let headers = axiosRes.headers;

      console.log({axiosRes})

      let response = new Response();
      response.headers = headers;
      response.statusCode = status;
      response.data = axiosRes.data;
      return response;
    } catch (e) {
      console.error(e)
      let response = new Response();

      response.headers = e.response?.headers;
      response.statusCode = e.response?.status;
      response.data = e.response?.data;
      response.message = e.response?.statusText;

      return response;
    }
  }
}
