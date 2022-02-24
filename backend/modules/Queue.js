const BeeQueue = require("bee-queue");
const queueSettings = {
    redis: {
        host: process.env.REDIS,
        port: process.env.REDIS_PORT || 6379,
    }
}

const stocksQueue = new BeeQueue('stocks', queueSettings);
const ordersQueue = new BeeQueue('orders', queueSettings);
const parserQueue = new BeeQueue('parser', queueSettings);

module.exports = {
    stocksQueue,
    ordersQueue,
    parserQueue
}