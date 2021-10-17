import Request from "../request";
import Response from "../response";
import { Model } from "@avanda/orm";
import { Sequelize } from "sequelize";

type AllowedMethods = 'any' | 'get' | 'post' | 'option'
export default abstract class Controller{
    protected model?: Model | any
    connection: Sequelize
    protected constructor(connection: Sequelize, model: Model | null = null, autolink: boolean =  false) {
        this.connection = connection;
        if (model){
            this.model = model;
            this.model.setModelName(this.model.constructor.name)
        }

    }
    async get(response: Response,request: Request): Promise<any> {
        return (await this.model?.first())
    }
    async getAll(response: Response,request: Request) {
        return (await this.model?.all())
    }
}