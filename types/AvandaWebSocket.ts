import WebSocket from "ws";
import Service from "./Service";

export default interface AvandaWebSocket extends WebSocket{
    clientId: string;
    clientIndex: number,
    service: Service
}