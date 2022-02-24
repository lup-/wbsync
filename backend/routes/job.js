const {getDb} = require("../modules/Database");
const {stocksQueue, ordersQueue, parserQueue} = require('../modules/Queue');

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
    async parser(ctx) {
        let jobParams = ctx.request.body && ctx.request.body.job;
        let job = parserQueue.createJob(jobParams);
        await job.save();
        delete job.queue;
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
        let lastDownloadAll = await db.collection('log').find({type: 'downloadAllStocks'}).sort({date: -1}).limit(1).toArray();
        let lastSync = await db.collection('log').find({type: 'syncAllOrders'}).sort({date: -1}).limit(1).toArray();
        let lastSingleDownloads = await db.collection('log').aggregate([
            {$match: {type: 'downloadStocks'}},
            {$sort: {date: -1}},
            {$group: {
                    _id: {type: "$type", key: "$key"},
                    logs: {$push: "$$ROOT"}
                }},
            {$addFields: {log: {$arrayElemAt: [ "$logs", 0 ]}}},
            {$replaceRoot: {newRoot: '$log'}},
            {$sort: {date: 1}}
        ]).toArray();

        ctx.body = {
            upload: lastUpload[0],
            downloadAll: lastDownloadAll[0],
            download: lastSingleDownloads,
            sync: lastSync[0]
        }
    }
}