import Request from "../request";
import Response from "../response";
import { Model } from "@avanda/orm";
import { Sequelize } from "sequelize";

type AllowedMethods = 'any' | 'get' | 'post' | 'option'
export default  class Controller{
    public model?: Model | any
    public exclude?: string[]
    // when set, clients may only filter (`ft`) on these columns; excluded columns can never be filtered on
    public filterable?: string[]
    connection: Sequelize
    constructor(connection: Sequelize, model: Model | null = null) {
        this.connection = connection;
        if (model){
            this.model = model;
            this.model.setModelName(this.model.constructor.name)
        }

    }
   

}