import WebSocket from "ws";
import Service from "./Service";
import express from "express";
import AvandaWebSocket from "./AvandaWebSocket";
import AvandaHttpRequest from "./AvandaHttpRequest";
import Controller from "../graph/controller";

export default interface WebSocketClient {
    client: AvandaWebSocket,
    id: string,
    service: Service,
    req: AvandaHttpRequest,
    res: express.Response,
}