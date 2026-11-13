import WebSocket from "ws";
import Query from "./graph/query";
import Response from "./response";
import AvandaWebSocket from "./types/AvandaWebSocket";

export default class StreamSocket {
  id: string;
  private connection: AvandaWebSocket;

  constructor(connection: AvandaWebSocket) {
    this.connection = connection;
    this.id = connection.clientId;
  }

  send(data: any) {
    if (this.connection.readyState !== WebSocket.OPEN) return;
    const response =
      data instanceof Response ? data : new Response().success("", data);
    this.connection.send(JSON.stringify(Query.responseToObject(response)));
  }

  close(code: number = 1000, reason: string = "") {
    // ws throws on a close reason longer than 123 bytes
    while (Buffer.byteLength(reason) > 123) reason = reason.slice(0, -1);
    this.connection.close(code, reason);
  }
}
