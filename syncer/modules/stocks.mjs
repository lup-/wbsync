import fs from "fs";
import {getDb, syncCollectionItems} from "./database.mjs";
import {getUniqueCodeByProps} from "./utils.mjs";
import clone from "lodash.clonedeep";
import moment from "moment";
import {InSales} from "./insales/index.mjs";

function getId(product) {
    return getUniqueCodeByProps(product);
}

function prepareProducts(products) {
    return products.map(srcProduct => {
        let dstProduct = clone(srcProduct);

        let sizes = [
            '8XL', '7XL', '6XL', '5XL', '4XL', '3XL', '2XL',
            'XXXXXXXXL', 'XXXXXXXL', 'XXXXXXL', 'XXXXXL', 'XXXXL', 'XXXL', 'XXL', 'XL',
            'XL2', 'XL3', 'XL4', 'XL5', 'XL6',
            'XS', 'L', 'M', 'S'
        ];
        let sizeRegex = new RegExp(`(${sizes.join('|')})$`);
        let match = srcProduct.sku.match(sizeRegex);
        if (match && match[1]) {
            let wearSize = match[1];
            dstProduct.size.de = wearSize;
        }

        match = srcProduct.sku.match(/-(\d\d)$/);
        if (match && match[1]) {
            let maxSize = 70;
            let minSize = 36;

            let size = parseInt(match[1]);
            if (size >= minSize && size <= maxSize) {
                dstProduct.size.ru = size;
            }
        }

        match = srcProduct.sku.match(/(\d+(\/|\\)\d+$)/);
        if (match && match[1]) {
            let jeansSize = match[1].replace('\\', '/');
            dstProduct.size.de = jeansSize;
        }

        dstProduct.source = '1c';
        dstProduct.quantity = parseInt(srcProduct.quantity);
        dstProduct.id = getId(dstProduct);
        dstProduct.created = moment().unix();
        dstProduct.updated = moment().unix();

        return dstProduct;
    });
}

async function downloadAllStocks(debug, jsonPath) {
    debug('Starting stocks sync');
    debug('Reading file %s', jsonPath);
    let rawData = fs.readFileSync(jsonPath);
    let products = JSON.parse(rawData);
    let preparedProducts = prepareProducts(products);

    debug('Sync 1C %s stocks with db...', products.length);
    let db = await getDb();
    await syncCollectionItems(
        db,
        preparedProducts,
        'stock',
        'id',
        'quantity',
        null,
        {source: '1c'}
    );

    debug('Sync Insales stocks with db...', products.length);
    let keys = await db.collection('keys').find({deleted: {$in: [null, false]}}).toArray();
    let insalesKeys = keys.filter(key => key.type === 'insales');
    if (insalesKeys.length > 0) {
        let dbStocks = await db.collection('stock').find({deleted: {$in: [null, false]}}).toArray();
        debug('Sync Insales stocks count: %s', dbStocks.length);
        for (let key of insalesKeys) {
            debug('Syncing %s', key.title);
            let insales = new InSales(key.insales_api_id, key.insales_api_password);
            let insalesStocks = await insales.getMatchedStocks(dbStocks, key);
            await syncCollectionItems(
                db,
                insalesStocks,
                'stock',
                'id',
                'quantity',
                null,
                {source: 'insales', keyId: key.id}
            );
        }
    }

    await db.collection('log').insertOne({
        type: 'downloadAllStocks',
        date: moment().unix(),
        jsonPath,
    });
}

async function uploadStocks(stockIds, idField, from, to) {
    stockIds = stockIds.filter(id => Boolean(id));
    let {source: fromSource, keyId: fromKeyId} = from;
    let {source: toSource, keyId: toKeyId} = to;

    let db = await getDb();
    let key = await db.collection('keys').findOne({id: toKeyId, deleted: {$in: [null, false]}});
    let stocksQuery = {
        source: fromSource,
        keyId: fromKeyId,
        deleted: {$in: [null, false]}
    };
    stocksQuery[idField] = {$in: stockIds};
    let stocks = await db.collection('stock').find(stocksQuery).toArray();

    let provider = null;
    if (toSource === 'insales') {
        provider = new InSales(key.insales_api_id, key.insales_api_password);
    }

    let errorIds = null;
    if (provider) {
        errorIds = await provider.syncLeftovers(stocks);
    }

    await db.collection('log').insertOne({
        type: 'uploadStocks',
        date: moment().unix(),
        from,
        to,
        idField,
        stockIds,
        errorIds
    });
}

export {downloadAllStocks, uploadStocks}
