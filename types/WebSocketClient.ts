import WebSocket from "ws";
import Service from "./Service";
import express from "express";
import AvandaWebSocket from "./AvandaWebSocket";
import AvandaHttpRequest from "./AvandaHttpRequest";
import Controller from "../graph/controller";
import Request from "../request";

export default interface WebSocketClient {
    client: AvandaWebSocket,
    id: string,
    busy: boolean,
    service: Service,
    req: AvandaHttpRequest,
    request: Request,
    res: express.Response,
}