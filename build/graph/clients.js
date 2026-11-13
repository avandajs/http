"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("@avanda/app");
const uuid_1 = require("uuid");
class Client {
    static registryKey(instanceId = Client.instanceId) {
        return "avanda:ws:clients:" + instanceId;
    }
    static async touch() {
        const redis = app_1.Redis.RedisClient.instance;
        if (!(redis === null || redis === void 0 ? void 0 : redis.isReady) || Client.activeClients.length < 1)
            return;
        await redis.sAdd(Client.registryKey(), Client.activeClients.map((client) => client.id));
        await redis.expire(Client.registryKey(), Client.ttlSeconds);
        await redis.sAdd(Client.instancesKey, Client.instanceId);
    }
    static startHeartbeat() {
        var _a, _b;
        if (Client.heartbeat)
            return;
        Client.heartbeat = setInterval(() => Client.touch().catch((e) => console.error("websocket registry heartbeat failed:", e)), (Client.ttlSeconds * 1000) / 3);
        (_b = (_a = Client.heartbeat).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    static stopHeartbeat() {
        if (Client.activeClients.length > 0 || !Client.heartbeat)
            return;
        clearInterval(Client.heartbeat);
        Client.heartbeat = undefined;
    }
    static async add(client) {
        Client.activeClients.push(client);
        await Client.touch();
        Client.startHeartbeat();
    }
    static async remove(id) {
        Client.activeClients = Client.activeClients.filter((client) => client.id != id);
        const redis = app_1.Redis.RedisClient.instance;
        if (redis === null || redis === void 0 ? void 0 : redis.isReady)
            await redis.sRem(Client.registryKey(), id);
        Client.stopHeartbeat();
    }
    static async count() {
        const redis = app_1.Redis.RedisClient.instance;
        if (!(redis === null || redis === void 0 ? void 0 : redis.isReady))
            return Client.activeClients.length;
        const instances = await redis.sMembers(Client.instancesKey);
        let total = 0;
        for (const instanceId of instances) {
            const key = Client.registryKey(instanceId);
            if (await redis.exists(key))
                total += await redis.sCard(key);
            else
                await redis.sRem(Client.instancesKey, instanceId);
        }
        return total;
    }
}
exports.default = Client;
// sockets can't be shared across instances, only their ids are kept in Redis
Client.activeClients = [];
Client.instanceId = (0, uuid_1.v4)();
Client.instancesKey = "avanda:ws:instances";
// a crashed instance stops refreshing, so its clients drop out of the count
Client.ttlSeconds = 30;
