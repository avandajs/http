import { Redis } from "@avanda/app";
import { v4 as uuid } from "uuid";
import WebSocketClient from "../types/WebSocketClient";

export default class Client {
  // sockets can't be shared across instances, only their ids are kept in Redis
  static activeClients: WebSocketClient[] = [];
  static instanceId: string = uuid();
  static instancesKey: string = "avanda:ws:instances";
  // a crashed instance stops refreshing, so its clients drop out of the count
  static ttlSeconds: number = 30;
  private static heartbeat?: ReturnType<typeof setInterval>;

  static registryKey(instanceId: string = Client.instanceId) {
    return "avanda:ws:clients:" + instanceId;
  }

  private static async touch() {
    const redis = Redis.RedisClient.instance;
    if (!redis?.isReady || Client.activeClients.length < 1) return;

    await redis.sAdd(
      Client.registryKey(),
      Client.activeClients.map((client) => client.id)
    );
    await redis.expire(Client.registryKey(), Client.ttlSeconds);
    await redis.sAdd(Client.instancesKey, Client.instanceId);
  }

  private static startHeartbeat() {
    if (Client.heartbeat) return;
    Client.heartbeat = setInterval(
      () =>
        Client.touch().catch((e) =>
          console.error("websocket registry heartbeat failed:", e)
        ),
      (Client.ttlSeconds * 1000) / 3
    );
    Client.heartbeat.unref?.();
  }

  private static stopHeartbeat() {
    if (Client.activeClients.length > 0 || !Client.heartbeat) return;
    clearInterval(Client.heartbeat);
    Client.heartbeat = undefined;
  }

  static async add(client: WebSocketClient) {
    Client.activeClients.push(client);
    await Client.touch();
    Client.startHeartbeat();
  }

  static async remove(id: string) {
    Client.activeClients = Client.activeClients.filter(
      (client) => client.id != id
    );
    const redis = Redis.RedisClient.instance;
    if (redis?.isReady) await redis.sRem(Client.registryKey(), id);
    Client.stopHeartbeat();
  }

  static async count(): Promise<number> {
    const redis = Redis.RedisClient.instance;
    if (!redis?.isReady) return Client.activeClients.length;

    const instances = await redis.sMembers(Client.instancesKey);
    let total = 0;
    for (const instanceId of instances) {
      const key = Client.registryKey(instanceId);
      if (await redis.exists(key)) total += await redis.sCard(key);
      else await redis.sRem(Client.instancesKey, instanceId);
    }
    return total;
  }
}
