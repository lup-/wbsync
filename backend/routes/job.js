const BeeQueue = require('bee-queue');
const {getDb} = require("../modules/Database");
const queueSettings = {
    redis: {
        host: process.env.REDIS,
        port: process.env.REDIS_PORT || 6379,
    }
}

const stocksQueue = new BeeQueue('stocks', queueSettings);
const ordersQueue = new BeeQueue('orders', queueSettings);

module.exports = {
    async syncStocks(ctx) {
        let jobParams = ctx.request.body && ctx.request.body.job;
        let job = stocksQueue.createJob(jobParams);
        await job.save();
        ctx.body = {job};
    },
    async syncOrders(ctx) {
        let jobParams = ctx.request.body && ctx.request.body.job;
        let job = ordersQueue.createJob(jobParams);
        await job.save();
        ctx.body = {job};
    },
    async status(ctx) {
        let jobParams = ctx.request.body && ctx.request.body.job;
        let queue = ctx.request.body && ctx.request.body.type === 'stocks'
            ? stocksQueue
            : ordersQueue;

        let job = await queue.getJob(jobParams.id);
        ctx.body = {job};
    },
    async lastJobs(ctx) {
        let db = await getDb();

        let lastUpload = await db.collection('log').find({type: 'uploadStocks'}).sort({date: -1}).limit(1).toArray();
        let lastDownload = await db.collection('log').find({type: 'downloadAllStocks'}).sort({date: -1}).limit(1).toArray();
        let lastSync = await db.collection('log').find({type: 'syncAllOrders'}).sort({date: -1}).limit(1).toArray();

        ctx.body = {
            upload: lastUpload[0],
            download: lastDownload[0],
            sync: lastSync[0]
        }
    }
}