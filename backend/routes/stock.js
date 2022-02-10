const {getDb} = require('../modules/Database');
const {getOrderFilter} = require('../modules/Orders');
const shortid = require('shortid');
const moment = require('moment');
const {clone} = require("mongodb/lib/core/topologies/shared");
const iconv = require('iconv-lite');

const COLLECTION_NAME = 'stock';
const ITEM_NAME = 'stock';
const ITEMS_NAME = 'stock';
const SORT_A_TO_BEGIN = -1;
const SORT_B_TO_BEGIN = 1;
const CSV_SEPARATOR = ";"

function lineToCsv(items) {
    return `"${items.join(`"${CSV_SEPARATOR}"`)}"`;
}

function stockToCsv(item, fields) {
    let fieldValues = fields.map(field => {
        let value = item[field];
        if (field.indexOf('.') !== -1 && typeof (value) === 'undefined') {
            let path = field.split('.');
            value = item;
            for (let step of path) {
                value = value[step];
            }
        }

        if (value instanceof Array) {
            value = value.join(', ');
        }

        return value || ''
    });
    return lineToCsv(fieldValues);
}

function prepareItemsForFrontend(items, variants, compareField, filter) {
    return items.map(item => {
        let compareItem = {title: null};
        if (item.sku) {
            compareItem.sku = item.sku;
        }

        if (item.barcode) {
            compareItem.barcode = item.barcode;
        }

        if (item.barcodeOrSku) {
            compareItem.barcodeOrSku = item.barcodeOrSku;
        }

        let allValuesEqual = true;
        let firstValue = null;
        let allValuesZero = true;

        let source = filter.source && filter.source[0] || '1c';
        for (let variant of variants) {
            let stockItem = item[variant.id];
            let value = null;
            if (stockItem instanceof Array) {
                value = stockItem.map(stockItem => {
                    return typeof (stockItem[compareField]) !== 'undefined'
                        ? stockItem[compareField]
                        : null;
                });
            }
            else {
                value = stockItem && typeof (stockItem[compareField]) !== 'undefined'
                    ? stockItem[compareField]
                    : null;
            }

            if (firstValue === null) {
                firstValue = value instanceof Array ? value[0] : value;
            }

            if (value instanceof Array) {
                for (let singleValue of value) {
                    allValuesEqual = allValuesEqual && firstValue === singleValue;
                    allValuesZero = allValuesZero && Number(singleValue) === 0;
                }
            }
            else {
                allValuesEqual = allValuesEqual && firstValue === value;
                allValuesZero = allValuesZero && Number(value) === 0;
            }

            compareItem[variant.id] = value instanceof Array
                ? value.map(item => item || 0).join(', ')
                : value;

            if (variant.source === source) {
                compareItem.title = stockItem ? stockItem.title : null;
            }
        }

        compareItem.todaySum = item.todaySum !== '' ? item.todaySum : '';
        compareItem.allValuesEqual = allValuesEqual;
        compareItem.allValuesZero = allValuesZero;

        compareItem.raw = item;

        return compareItem;
    });
}

function uniqueValuesOrSingleValue(items, field) {
    let fieldValues = items
        .map(item => item[field])
        .filter(value => Boolean(value));

    let uniqueValues = fieldValues
        .filter((value, index, array) => array.indexOf(value) === index);

    if (uniqueValues.length === 0) {
        return null;
    }

    if (uniqueValues.length === 1) {
        return uniqueValues[0];
    }

    return uniqueValues;
}

function getUniqueKeySources(items) {
    let uniqueKeySources = {};

    for (const item of items) {
        for (const stock of item.stocks) {
            let keySource = [stock.source, stock.keyId].filter(part => Boolean(part)).join('.');

            if (!uniqueKeySources[keySource]) {
                uniqueKeySources[keySource] = {
                    id: keySource,
                    source: stock.source,
                    keyId: stock.keyId || null
                }
            }
        }
    }

    uniqueKeySources = Object.values(uniqueKeySources);
    uniqueKeySources.sort((a, b) => {
        if (a.source === '1c') {
            return SORT_A_TO_BEGIN;
        }

        if (b.source === '1c') {
            return SORT_B_TO_BEGIN;
        }

        if (a.keyId === null) {
            return SORT_A_TO_BEGIN;
        }

        if (b.keyId === null) {
            return SORT_B_TO_BEGIN;
        }

        return a && a.key && b && b.key ? a.key.localeCompare(b.key) : 0;
    });

    return uniqueKeySources;
}

module.exports = {
    async list(ctx) {
        let inputFilter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};
        let sort = ctx.request.body && ctx.request.body.sort
            ? ctx.request.body.sort || {}
            : {};

        let limit = ctx.request.body.limit ? parseInt(ctx.request.body.limit) : null;
        let offset = ctx.request.body.offset ? parseInt(ctx.request.body.offset) : 0;
        let downloadAsCsv = ctx.request.body.downloadAsCsv || false;

        let defaultFilter = {
            'deleted': {$in: [null, false]}
        };

        let filter = Object.assign(defaultFilter, {});
        for (let field in inputFilter) {
            let value = inputFilter[field];
            if (value instanceof Array) {
                filter[field] = {$in: value}
            }
            else if (field === "hasQuantity") {
                filter['quantity'] = {$gt: 0};
            }
            else if (field === "barcode") {
                let intValue = null;
                try {
                    intValue = parseInt(value);
                }
                finally {
                    let matchQuery = intValue !== null
                        ? {$in: [value, intValue]}
                        : value;

                    filter['barcode'] = matchQuery;
                }
            }
            else {
                filter[field] = value;
            }
        }

        let db = await getDb();
        let cursor = db.collection(COLLECTION_NAME)
            .find(filter)
            .sort(sort);

        if (!downloadAsCsv) {
            cursor = cursor.skip(offset);
            if (limit !== -1) {
                cursor = cursor.limit(limit);
            }
        }

        let items = await cursor.toArray();

        if (downloadAsCsv) {
            let jsonFields = [
                {text: 'Источник', value: 'source'},
                {text: 'Название', value: 'title'},
                {text: 'Цвет', value: 'color'},
                {text: 'Размер RU', value: 'size.ru'},
                {text: 'Размер DE', value: 'size.de'},
                {text: 'Артикул', value: 'sku'},
                {text: 'Штрих-код', value: 'barcode'},
                {text: 'Количество', value: 'quantity'},
                {text: 'Цена', value: 'price'},
            ];

            let header = jsonFields.map(item => item.text);
            let fieldCodes = jsonFields.map(item => item.value);

            let csvLines = [];
            csvLines.push(lineToCsv(header));

            let stockLines = items.map(stockItem => stockToCsv(stockItem, fieldCodes))
            csvLines = csvLines.concat(stockLines);

            let csv = csvLines.join('\n');

            ctx.attachment(`stocks_${moment().unix()}.csv`);
            ctx.statusCode = 200;
            ctx.type = 'text/csv';
            ctx.body = iconv.encode(csv, 'windows-1251');
        }
        else {
            let totalCount = await db.collection(COLLECTION_NAME).countDocuments(filter);

            let response = {};
            response[ITEMS_NAME] = items;
            response['totalCount'] = totalCount;

            ctx.body = response;
        }
    },
    async match(ctx) {
        ctx.request.socket.setTimeout(5 * 60 * 1000);
        ctx.req.setTimeout(5 * 60 * 1000);

        let inputFilter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};
        let sort = ctx.request.body && ctx.request.body.sort
            ? ctx.request.body.sort || {}
            : {};

        let limit = ctx.request.body.limit ? parseInt(ctx.request.body.limit) : null;
        let inputLimit = limit;
        let offset = ctx.request.body.offset ? parseInt(ctx.request.body.offset) : 0;
        let inputOffset = offset;
        let onlyMatched = typeof (ctx.request.body.onlyMatched) !== 'undefined'
            ? Boolean(ctx.request.body.onlyMatched)
            : false;
        let onlyUnequal = typeof (ctx.request.body.onlyUnequal) !== 'undefined'
            ? Boolean(ctx.request.body.onlyUnequal)
            : false;
        let matchField = ctx.request.body.matchField || 'barcode';
        let compareField = ctx.request.body.compareField || 'quantity';
        let downloadAsCsv = ctx.request.body.downloadAsCsv || false;

        if (onlyUnequal) {
            limit = -1;
            offset = 0;
        }

        let inputOrderFilter = {};
        let hasOrdersFilter = false;
        if (inputFilter.orders) {
            hasOrdersFilter = true;
            inputOrderFilter = clone(inputFilter.orders);
            delete inputFilter.orders;
        }

        if (inputFilter.ordersDate) {
            hasOrdersFilter = true;
            inputOrderFilter['updated'] = {$gte: inputFilter.ordersDate};
            delete inputFilter.ordersDate;
        }

        let db = await getDb();

        let orderStockCount = {};
        if (hasOrdersFilter) {
            let orderFilter = getOrderFilter(inputOrderFilter);

            let orders = await db.collection('orders').find(orderFilter).toArray();

            for (let order of orders) {
                for (let product of order.products) {
                    if (product.barcode) {
                        let id = product[matchField];
                        if (typeof (orderStockCount[id]) === 'undefined') {
                            orderStockCount[id] = product[compareField];
                        }
                        else {
                            orderStockCount[id] += product[compareField];
                        }
                    }
                }
            }
        }

        let productInOrdersBarcodes = Object.keys(orderStockCount);
        let barcodeFilter = productInOrdersBarcodes.length > 0
            ? {barcode: {$in: productInOrdersBarcodes}}
            : {};

        let defaultFilter = {
            'deleted': {$in: [null, false]}
        };

        let filter = Object.assign(defaultFilter, {});
        for (let field in inputFilter) {
            let value = inputFilter[field];
            if (value instanceof Array) {
                filter[field] = {$in: value}
            }
            else if (field === "hasQuantity") {
                filter['quantity'] = {$gt: 0};
            }
            else if (field === "barcode") {
                let intValue = null;
                try {
                    intValue = parseInt(value);
                }
                finally {
                    let matchQuery = intValue !== null
                        ? {$in: [value, intValue]}
                        : value;

                    filter['barcode'] = matchQuery;
                }
            }
            else {
                filter[field] = value;
            }
        }

        let notEmptyMatchFieldFilter = {};
        if (matchField === 'barcodeOrSku') {
            notEmptyMatchFieldFilter = {
                $or: [
                    {barcode: {$nin: [null, false, ""]}},
                    {sku: {$nin: [null, false, ""]}}
                ]
            }
        }
        else {
            notEmptyMatchFieldFilter[matchField] = {$nin: [null, false, '']};
        }

        let pipeline = [
            { $match: notEmptyMatchFieldFilter },
            { $match: filter },
            { $match: barcodeFilter },
            { $addFields: {
                barcodeOrSku: {$cond: {if: {$in: ["$barcode", ["", null, false]]}, then: "$sku", else: "$barcode"}}
            } },
            {
                $project: {raw: 0}
            },
            { $group: {"_id": `$${matchField}`, "stocks": {$addToSet: "$$ROOT"}} },
        ];

        if (onlyMatched) {
            pipeline.push({ $match: {'stocks.1': {$type: 'object'}} })
        }

        if (sort && Object.keys(sort).length > 0) {
            pipeline.push({ $sort: sort });
        }

        let cursor = db.collection(COLLECTION_NAME)
            .aggregate(pipeline, { allowDiskUse: true });

        if (!downloadAsCsv) {
            cursor = cursor.skip(offset);

            if (limit !== -1) {
                cursor = cursor.limit(limit);
            }
        }

        let items = await cursor.toArray();
        let uniqueKeySources = getUniqueKeySources(items);

        let compareItems = items.map(item => {
            let compareItem = {
                id: item._id,
                barcode: uniqueValuesOrSingleValue(item.stocks, 'barcode'),
                sku: uniqueValuesOrSingleValue(item.stocks, 'sku'),
                barcodeOrSku: uniqueValuesOrSingleValue(item.stocks, 'barcodeOrSku'),
            };

            compareItem.todaySum = 0;
            for (let keySource of uniqueKeySources) {
                let stocks = item.stocks.filter(stock => {
                    let hasKey = keySource.keyId !== null;
                    let matchesKey = hasKey && keySource.keyId === stock.keyId;
                    let matchesSource = stock.source === keySource.source;

                    return hasKey
                        ? matchesKey && matchesSource
                        : matchesSource;
                });

                let stock = stocks.length === 1 ? stocks[0] : stocks;

                compareItem[keySource.id] = stock || null;
                let stockId = stock[matchField];
                if (orderStockCount[stockId]) {
                    compareItem.todaySum = orderStockCount[stockId] || '';
                }
            }

            return compareItem;
        });

        let totalCount = items.length;
        if (limit !== -1) {
            pipeline = pipeline.filter(stage => ['$skip', '$limit'].indexOf(Object.keys(stage)[0]) === -1)
            pipeline.push({$count: 'totalDocuments'});

            let countItem = await db.collection(COLLECTION_NAME).aggregate(pipeline, {allowDiskUse: true}).toArray();
            totalCount = countItem && countItem[0] ? countItem[0].totalDocuments : 0;
        }

        let frontendItems = prepareItemsForFrontend(compareItems, uniqueKeySources, compareField, filter);
        if (onlyUnequal) {
            frontendItems = frontendItems.filter(item => item.allValuesEqual === false && item.allValuesZero === false);
            totalCount = frontendItems.length;
            frontendItems = frontendItems.splice(inputOffset, inputLimit);
            compareItems = compareItems.splice(inputOffset, inputLimit);
        }

        if (downloadAsCsv) {
            let defaultFilter = {
                'deleted': {$in: [null, false]}
            };

            let db = await getDb();
            let keys = await db.collection('keys').find({'deleted': {$in: [null, false]}}).toArray();
            let keyTitles = keys.reduce((aggr, key) => {
                aggr[key.id] = key.title;
                return aggr;
            }, {});

            let jsonFields = [
                {text: 'Штрих-код', value: 'barcode'},
                {text: 'Артикул', value: 'sku'},
                {text: 'Название', value: 'title'},
                {text: 'Сколько в заказах', value: 'todaySum', sortable: false}
            ];

            let compareHeaders = uniqueKeySources.map(variant => ({
                text: variant.keyId ? keyTitles[variant.keyId] : variant.source,
                value: variant.id,
            }));

            jsonFields = jsonFields.concat(compareHeaders);

            let header = jsonFields.map(item => item.text);
            let fieldCodes = jsonFields.map(item => item.value);

            let csvLines = [];
            csvLines.push(lineToCsv(header));

            let stockLines = frontendItems.map(compareItem => stockToCsv(compareItem, fieldCodes))
            csvLines = csvLines.concat(stockLines);

            let csv = csvLines.join('\n');

            ctx.attachment(`compare_${moment().unix()}.csv`);
            ctx.statusCode = 200;
            ctx.type = 'text/csv';
            ctx.body = iconv.encode(csv, 'windows-1251');
        }
        else {
            let response = {};
            response[ITEMS_NAME] = compareItems;
            response['compare'] = frontendItems;
            response['totalCount'] = totalCount;
            response['variants'] = uniqueKeySources;

            ctx.body = response;
        }
    },
    async matchWithProducts(ctx) {
        ctx.request.socket.setTimeout(5 * 60 * 1000);
        ctx.req.setTimeout(5 * 60 * 1000);

        let inputFilter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};

        let sort = ctx.request.body && ctx.request.body.sort
            ? ctx.request.body.sort || {}
            : {};

        let limit = ctx.request.body.limit ? parseInt(ctx.request.body.limit) : null;
        let offset = ctx.request.body.offset ? parseInt(ctx.request.body.offset) : 0;
        let downloadAsCsv = ctx.request.body.downloadAsCsv || false;
        let onlyUnequal = typeof (ctx.request.body.onlyUnequal) !== 'undefined'
            ? Boolean(ctx.request.body.onlyUnequal)
            : false;

        let defaultFilter = {
            'deleted': {$in: [null, false]}
        };

        let filter = Object.assign(defaultFilter, inputFilter);

        let pipeline = [
            { $match: filter },
            { $unwind: '$barcode' },
            { $lookup: {
                from: "stock",
                localField: "barcode",
                foreignField: "barcode",
                as: "stock"
            } },
            { $unwind: '$stock' },
            { $group: {
                _id: '$_id',
                title: {$first: '$title'},
                barcode: {$addToSet: '$barcode'},
                sku: {$addToSet: '$sku'},
                stockSku: {$addToSet: '$stock.sku'},
                price: {$first: '$price'},
                quantity: {$first: '$quantity'},
                props: {$first: '$props'},
                stocks: {$push: {
                    source: '$stock.source',
                    keyId: '$stock.keyId',
                    quantity: '$stock.quantity',
                    price: '$stock.price',
                }}
            } },
            { $addFields: {stockQuantities: {$map: {
                input: '$stocks',
                as: 'src',
                in: '$$src.quantity'
            }}} },
            { $addFields: {sameQuantity: {$reduce: {
                input: '$stockQuantities',
                initialValue: true,
                in: {$and: ['$$value', {$eq: ['$$this', '$quantity']}]}
            }}} },
        ];

        if (onlyUnequal) {
            pipeline.push({$match: {sameQuantity: false}});
        }

        let db = await getDb();

        if (sort && Object.keys(sort).length > 0) {
            pipeline.push({ $sort: sort });
        }

        let cursor = db.collection('products').aggregate(pipeline, { allowDiskUse: true });

        if (!downloadAsCsv) {
            cursor = cursor.skip(offset);

            if (limit !== -1) {
                cursor = cursor.limit(limit);
            }
        }

        let items = await cursor.toArray();
        let uniqueKeySources = getUniqueKeySources(items);

        let totalCount = items.length;
        if (limit !== -1) {
            pipeline = pipeline.filter(stage => ['$skip', '$limit'].indexOf(Object.keys(stage)[0]) === -1)
            pipeline.push({$count: 'totalDocuments'});

            let countItem = await db.collection('products').aggregate(pipeline, {allowDiskUse: true}).toArray();
            totalCount = countItem && countItem[0] ? countItem[0].totalDocuments : 0;
        }

        if (downloadAsCsv) {
            let db = await getDb();
            let keys = await db.collection('keys').find({'deleted': {$in: [null, false]}}).toArray();
            let keyTitles = keys.reduce((aggr, key) => {
                aggr[key.id] = key.title;
                return aggr;
            }, {});

            let jsonFields = [
                {text: 'Штрих-код', value: 'barcode'},
                {text: 'Артикул', value: 'sku'},
                {text: 'Название', value: 'title'}
            ];

            let compareHeaders = uniqueKeySources.map(variant => ({
                text: variant.keyId ? keyTitles[variant.keyId] : variant.source,
                value: variant.id,
            }));

            jsonFields = jsonFields.concat(compareHeaders);

            let header = jsonFields.map(item => item.text);

            let csvLines = [];
            csvLines.push(lineToCsv(header));

            let csv = csvLines.join('\n');

            ctx.attachment(`compare_${moment().unix()}.csv`);
            ctx.statusCode = 200;
            ctx.type = 'text/csv';
            ctx.body = iconv.encode(csv, 'windows-1251');
        }
        else {
            ctx.body = {
                'compare': items,
                'totalCount': totalCount,
                'variants': uniqueKeySources,
            };
        }
    },
    async add(ctx) {
        let itemFields = ctx.request.body[ITEM_NAME];
        if (itemFields._id) {
            let response = {};
            response[ITEM_NAME] = false;

            ctx.body = response;
            return;
        }

        itemFields = Object.assign(itemFields, {
            id: shortid.generate(),
            created: moment().unix(),
            updated: moment().unix(),
        });

        const db = await getDb();
        let result = await db.collection(COLLECTION_NAME).insertOne(itemFields);
        let item = result.ops[0];
        let response = {};
        response[ITEM_NAME] = item;

        ctx.body = response;
    },
    async update(ctx) {
        const db = await getDb();

        let itemFields = ctx.request.body[ITEM_NAME];
        let id = itemFields.id;

        if (itemFields._id) {
            delete itemFields._id;
        }

        itemFields = Object.assign(itemFields, {
            updated: moment().unix(),
        });

        let updateResult = await db.collection(COLLECTION_NAME).findOneAndReplace({id}, itemFields, {returnOriginal: false});
        let item = updateResult.value || false;
        let response = {};
        response[ITEM_NAME] = item;

        ctx.body = response;
    },
    async delete(ctx) {
        const db = await getDb();

        let itemFields = ctx.request.body[ITEM_NAME];
        let id = itemFields.id;

        let updateResult = await db.collection(COLLECTION_NAME).findOneAndUpdate({id}, {$set: {deleted: moment().unix()}}, {returnOriginal: false});
        let item = updateResult.value || false;
        let response = {};
        response[ITEM_NAME] = item;

        ctx.body = response;
    }
}