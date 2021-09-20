import BeeQueue from "bee-queue";
import createDebug from "debug";
import {downloadAllStocks, uploadStocks} from "./modules/stocks.mjs";
import {syncAllOrders} from "./modules/orders.mjs";

const queueSettings = {
    redis: {
        host: process.env.REDIS,
        port: process.env.REDIS_PORT || 6379,
    }
}

const stocksQueue = new BeeQueue('stocks', queueSettings);
const ordersQueue = new BeeQueue('orders', queueSettings);
const debug = createDebug('syncer:job');
const jsonPath = process.env['JSON_PATH'];

stocksQueue.process(async (job) => {
    let jobType = job.data.type;
    let result = null;

    debug('Processing %s job %s', jobType, job.id);
    if (jobType === 'upload') {
        let {ids: stockIds, field: idField, from, to} = job.data;
        result = await uploadStocks(stockIds, idField, from, to, debug);
    }

    if (jobType === 'download') {
        result = await downloadAllStocks(debug, jsonPath);
    }

    debug('Finished %s job %s', jobType, job.id);
    return result;
});

ordersQueue.process(async (job) => {
    debug('Processing orders job %s', job.id);
    await syncAllOrders(debug);
    debug('Finished orders job %s', job.id);
});