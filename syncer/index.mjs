import {InSales} from "./modules/insales/index.mjs";
import {getDb} from "./modules/database.mjs";
import createDebug from "debug";

const debug = createDebug('syncer:uploadStocks');
const uploadKeyId = process.argv[2]; //xihRLvsii

(async () => {
    debug('Starting stocks upload');
    debug('Key id: %s', uploadKeyId);

    let db = await getDb();
    let key = await db.collection('keys').findOne({id: uploadKeyId});
    if (!key) {
        process.exit();
        return;
    }

    debug('Key %s, type: %s', key.title, key.type);
    if (key.type === 'insales') {
        let insales = new InSales(key.insales_api_id, key.insales_api_password);
        let dbStocks = await db.collection('stock').find({deleted: {$in: [null, false]}}).toArray();
        await insales.syncLeftovers(dbStocks);
    }

    debug('Done!');
    process.exit();
})();