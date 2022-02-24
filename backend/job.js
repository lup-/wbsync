const {getDb} = require('./modules/Database');
const {parserQueue} = require('./modules/Queue');
const moment = require("moment");
const {checkAndParseNewItems, checkAndParseAllItems} = require('./modules/Parser');

async function parseNew() {
    let db = await getDb();

    let parsedWatchItems = await checkAndParseNewItems();
    await db.collection('log').insertOne({
        type: 'parseNew',
        date: moment().unix(),
        parsedWatchItems
    });
}

async function parseAll() {
    let db = await getDb();

    let parsedWatchItems = await checkAndParseAllItems();
    await db.collection('log').insertOne({
        type: 'parseAll',
        date: moment().unix(),
        parsedWatchItems
    });
}

module.exports = function startParserQueueProcessing() {
    parserQueue.process(async (job) => {
        let jobType = job.data.type;
        let result = null;

        if (jobType === 'parseAll') {
            result = await parseAll();
        }

        if (jobType === 'parseNew') {
            result = await parseNew();
        }

        return result;
    });
}
