import fs from "fs";
import {getDb, syncCollectionItems} from "./database.mjs";
import {getUniqueCodeByProps} from "./utils.mjs";
import clone from "lodash.clonedeep";
import moment from "moment";
import {InSales} from "./insales/index.mjs";
import {Ozon} from "./ozon/index.mjs";
import {Wildberries} from "./wildberries/index.mjs";
import {ObjectId} from "mongodb";

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
        dstProduct.raw = srcProduct;

        return dstProduct;
    });
}

async function downloadStocksForKey(db, key, debug) {
    let results = false;
    let count = 0;
    if (key.type === 'insales') {
        debug('Syncing Insales %s', key.title);
        let insales = new InSales(key.insales_api_id, key.insales_api_password, key.api_base);
        let insalesStocks = await insales.fetchStocksForDb(key);
        count = insalesStocks ? insalesStocks.length : 0;

        if (count > 0) {
            results = await syncCollectionItems(
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

    if (key.type === 'wildberries') {
        debug('Syncing Wildberries %s', key.title);
        let wb = new Wildberries(key.wb_64bit, key.wb_new);
        let wbStocks = await wb.fetchStocksForDb(key);
        count = wbStocks.length;

        results = await syncCollectionItems(
            db,
            wbStocks,
            'stock',
            'id',
            'quantity',
            null,
            {source: 'wildberries', keyId: key.id}
        );
    }

    if (key.type === 'ozon') {
        return;
        debug('Syncing Ozon %s', key.title);
        let ozon = new Ozon(key.client_id, key.api_key);
        let ozonStocks = await ozon.fetchStocksForDb(key);
        count = ozonStocks.length;

        results = await syncCollectionItems(
            db,
            ozonStocks,
            'stock',
            'id',
            'quantity',
            null,
            {source: 'ozon', keyId: key.id}
        );
    }

    await db.collection('log').insertOne({
        type: 'downloadStocks',
        date: moment().unix(),
        from: key.type,
        key,
        isSuccess: results ? results.isSuccess : false,
        newItems: results ? results.newItems : false,
        updatedItems: results ? results.updatedItems : false,
        count
    });
}

async function downloadAllStocks(debug, jsonPath) {
    debug('Starting stocks sync');
    debug('Reading file %s', jsonPath);
    let rawData = fs.readFileSync(jsonPath);
    let products = JSON.parse(rawData);

    let fileFd = fs.openSync(jsonPath, 'r');
    let stat = fs.fstatSync(fileFd);
    fs.closeSync(fileFd);

    let preparedProducts = prepareProducts(products);

    debug('Sync 1C %s stocks with db...', products.length);
    let db;
    try {
        db = await getDb();
    }
    catch (e) {
        debug('Error connecting to DB: %s', e.toString());
        return false;
    }
    let {isSuccess, newItems, updatedItems} = await syncCollectionItems(
        db,
        preparedProducts,
        'stock',
        'id',
        'quantity',
        null,
        {source: '1c'}
    );

    await db.collection('log').insertOne({
        type: 'downloadStocks',
        date: moment().unix(),
        from: '1c',
        path: jsonPath,
        stat,
        isSuccess,
        newItems,
        updatedItems,
        count: products.length
    });

    debug('Sync stocks with db...', products.length);
    let keys = await db.collection('keys').find({deleted: {$in: [null, false]}}).toArray();

    for (let key of keys) {
        try {
            await downloadStocksForKey(db, key, debug);
        }
        catch (e) {
            debug(e);
        }
    }

    await db.collection('log').insertOne({
        type: 'downloadAllStocks',
        date: moment().unix(),
        jsonPath,
    });
}

async function uploadStocks(stockIds, idField, from, to, debug) {
    stockIds = stockIds.filter(id => Boolean(id));
    let {source: fromSource, keyId: fromKeyId} = from;
    let {source: toSource, keyId: toKeyId} = to;

    let db = await getDb();
    let key = await db.collection('keys').findOne({id: toKeyId, deleted: {$in: [null, false]}});
    let fromStocksQuery = {
        source: fromSource,
        keyId: fromKeyId,
        deleted: {$in: [null, false]}
    };
    fromStocksQuery[idField] = {$in: stockIds};

    let toStocksQuery = {
        source: toSource,
        keyId: toKeyId,
        deleted: {$in: [null, false]}
    }

    let fromStocks = await db.collection('stock').find(fromStocksQuery).toArray();
    let toStocks = await db.collection('stock').find(toStocksQuery).toArray();

    let provider = null;
    if (toSource === 'insales') {
        provider = new InSales(key.insales_api_id, key.insales_api_password, key.api_base);
    }

    if (toSource === 'wildberries') {
        provider = new Wildberries(key.wb_64bit, key.wb_new);
    }

    if (toSource === 'ozon') {
        provider = new Ozon(key.client_id, key.api_key);
    }

    let errorIds = null;
    if (provider) {
        let isDbSync = false;
        try {
            errorIds = await provider.syncLeftovers(isDbSync, fromStocks, toStocks);
            await downloadStocksForKey(db, key, debug);
        }
        catch (e) {
            debug(e);
        }
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

async function uploadProductStocks(stockIds, to, debug) {
    stockIds = stockIds
        .filter(id => Boolean(id))
        .map(strId => new ObjectId(strId));
    let {source: toSource, keyId: toKeyId} = to;

    let db = await getDb();
    let key = await db.collection('keys').findOne({id: toKeyId, deleted: {$in: [null, false]}});

    let toStocksQuery = {
        source: toSource,
        keyId: toKeyId,
        deleted: {$in: [null, false]}
    }

    let fromStocks = await db.collection('products').find({_id: {$in: stockIds}}).toArray();
    let toStocks = await db.collection('stock').find(toStocksQuery).toArray();

    let provider = null;
    if (toSource === 'insales') {
        provider = new InSales(key.insales_api_id, key.insales_api_password, key.api_base);
    }

    if (toSource === 'wildberries') {
        provider = new Wildberries(key.wb_64bit, key.wb_new);
    }

    if (toSource === 'ozon') {
        provider = new Ozon(key.client_id, key.api_key);
    }

    let errorIds = null;
    if (provider) {
        let isDbSync = true;
        try {
            errorIds = await provider.syncLeftovers(isDbSync, fromStocks, toStocks);
            await downloadStocksForKey(db, key, debug);
        }
        catch (e) {
            debug(e);
        }
    }

    await db.collection('log').insertOne({
        type: 'uploadProductStocks',
        date: moment().unix(),
        to,
        stockIds,
        errorIds
    });
}

export {downloadAllStocks, uploadStocks, uploadProductStocks}
