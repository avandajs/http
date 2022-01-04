import Request from "../request";
import Response from "../response";
import { Model } from "@avanda/orm";
import { Sequelize } from "sequelize";

type AllowedMethods = 'any' | 'get' | 'post' | 'option'
export default  class Controller{
    public model?: Model | any
    public exclude?: string[]
    connection: Sequelize
    constructor(connection: Sequelize, model: Model | null = null) {
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
    async getAllByPage(response: Response,request: Request) {
        let data = await this.model?.page(request.page)
        response.totalPages = this.model.totalPages
        response.currentPage = request.page
        return response.success('Data fetched',data)
    }

}