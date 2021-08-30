const {getDb} = require('../modules/Database');
const shortid = require('shortid');
const moment = require('moment');

const COLLECTION_NAME = 'orders';
const ITEM_NAME = 'order';
const ITEMS_NAME = 'orders';

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

        let dateFlagFilters = ['created', 'updated', 'canceled', 'completed'];
        let filter = Object.assign(defaultFilter, {});
        for (let field in inputFilter) {
            let value = inputFilter[field];
            if (value instanceof Array) {
                filter[field] = {$in: value}
            }
            else if (dateFlagFilters.indexOf(field) !== -1) {
                if (typeof(value) === 'boolean') {
                    filter[field] = value
                        ? {$gt: 0}
                        : {$in: [null, false, 0]};
                }
                else {
                    filter[field] = value;
                }
            }
            else if (field === "id") {
                let intValue = null;
                try {
                    intValue = parseInt(value);
                }
                finally {
                    filter[field] = intValue !== null
                        ? {$in: [value, intValue]}
                        : value;
                }
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

                    filter['products'] = {$elemMatch: {barcode: matchQuery}};
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
    },
    async filters(ctx) {
        let filter = {'deleted': {$in: [null, false]}};

        let db = await getDb();
        let statuses = await db.collection('orders').aggregate([
            {$match: filter},
            {$match: {'status': {$nin: [null, false]}}},
            {$group: {"_id": '$status', id: {$first: '$status'}, text: {$first: '$statusText'}}}
        ]).toArray();

        let orderTypes = await db.collection('orders').aggregate([
            {$match: filter},
            {$match: {'orderType': {$nin: [null, false]}}},
            {$group: {"_id": '$orderType'}}
        ]).toArray();

        ctx.body = {
            status: statuses.map(item => ({id: item.id, text: item.text})),
            orderType: orderTypes.map(item => ({id: item._id, text: item._id})),
            source: [
                {id: 'wildberries', text: 'Wildberries'},
                {id: 'ozon', text: 'Ozon'},
                {id: 'insales', text: 'InSales'},
            ]
        }
    }
}