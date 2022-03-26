import WebSocket from "ws";
import Service from "./Service";
import express from "express";

export default interface WebSocketClient {
    client: WebSocket,
    id: number,
    service: Service,
    req: express.Request,
    res: express.Response
}