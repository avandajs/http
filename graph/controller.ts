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
   

}