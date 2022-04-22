const {getDb} = require('../modules/Database');
const {ObjectId} = require('mongodb');
const {prepareProducts} = require('../modules/Product');

const moment = require('moment');

const COLLECTION_NAME = 'products';
const ITEM_NAME = 'product';
const ITEMS_NAME = 'products';

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

        let filter = Object.assign(defaultFilter, inputFilter);

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

        let productType = await db.collection('productTypes').findOne({id: itemFields.productTypeId});
        let product = prepareProducts([itemFields.props], productType)[0];

        product = Object.assign(product, {
            created: moment().unix(),
            updated: moment().unix(),
        });

        const db = await getDb();
        let result = await db.collection(COLLECTION_NAME).insertOne(product);
        let item = result.ops[0];
        let response = {};
        response[ITEM_NAME] = item;

        ctx.body = response;
    },
    async update(ctx) {
        const db = await getDb();

        let itemFields = ctx.request.body[ITEM_NAME];
        let _id = new ObjectId(itemFields._id);

        if (itemFields._id) {
            delete itemFields._id;
        }

        let productType = await db.collection('productTypes').findOne({id: itemFields.productTypeId});
        let product = prepareProducts([itemFields.props], productType)[0];

        product = Object.assign(product, {
            updated: moment().unix(),
        });

        let updateResult = await db.collection(COLLECTION_NAME).findOneAndReplace({_id}, product, {returnOriginal: false});
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