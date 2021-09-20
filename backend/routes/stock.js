const {getDb} = require('../modules/Database');
const {getOrderFilter} = require('../modules/Orders');
const shortid = require('shortid');
const moment = require('moment');
const {clone} = require("mongodb/lib/core/topologies/shared");

const COLLECTION_NAME = 'stock';
const ITEM_NAME = 'stock';
const ITEMS_NAME = 'stock';
const SORT_A_TO_BEGIN = -1;
const SORT_B_TO_BEGIN = 1;

function todayStockCount() {
    let stockCount = {};
    for (let order of this.todayOrders) {
        for (let product of order.products) {
            let id = product[this.matchField];
            if (typeof (stockCount[id]) === 'undefined') {
                stockCount[id] = product[this.compareField];
            }
            else {
                stockCount[id] += product[this.compareField];
            }
        }
    }

    return stockCount;
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
            .sort(sort)
            .skip(offset);

        if (limit !== -1) {
            cursor = cursor.limit(limit);
        }

        let items = await cursor.toArray();

        let totalCount = await db.collection(COLLECTION_NAME).countDocuments(filter);

        let response = {};
        response[ITEMS_NAME] = items;
        response['totalCount'] = totalCount;

        ctx.body = response;
    },
    async match(ctx) {
        let inputFilter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};
        let sort = ctx.request.body && ctx.request.body.sort
            ? ctx.request.body.sort || {}
            : {};

        let limit = ctx.request.body.limit ? parseInt(ctx.request.body.limit) : null;
        let offset = ctx.request.body.offset ? parseInt(ctx.request.body.offset) : 0;
        let onlyMatched = ctx.request.body.onlyMatched ? Boolean(ctx.request.body.onlyMatched) : true;
        let matchField = ctx.request.body.matchField || 'barcode';
        let compareField = ctx.request.body.compareField || 'quantity';

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
        notEmptyMatchFieldFilter[matchField] = {$nin: [null, false, '']};

        let pipeline = [
            { $match: notEmptyMatchFieldFilter },
            { $match: filter },
            { $match: barcodeFilter },
            { $group: {"_id": `$${matchField}`, "stocks": {$addToSet: "$$ROOT"}} },
        ];

        if (onlyMatched) {
            pipeline.push({ $match: {'stocks.1': {$type: 'object'}} })
        }

        if (sort && Object.keys(sort).length > 0) {
            pipeline.push({ $sort: sort });
        }

        let cursor = db.collection(COLLECTION_NAME)
            .aggregate(pipeline)
            .skip(offset);

        if (limit !== -1) {
            cursor = cursor.limit(limit);
        }

        let items = await cursor.toArray();
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

        let compareItems = items.map(item => {
            let compareItem = {id: item._id};
            compareItem[matchField] = item._id;
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

        pipeline = pipeline.filter(stage => ['$skip', '$limit'].indexOf(Object.keys(stage)[0]) === -1)
        pipeline.push({ $count: 'totalDocuments' });

        let countItem = await db.collection(COLLECTION_NAME).aggregate(pipeline).toArray();
        let totalCount = countItem && countItem[0] ? countItem[0].totalDocuments : 0;

        let response = {};
        response[ITEMS_NAME] = compareItems;
        response['totalCount'] = totalCount;
        response['variants'] = uniqueKeySources;

        ctx.body = response;
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