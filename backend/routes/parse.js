const {getDb} = require('../modules/Database');
const shortid = require('shortid');
const moment = require('moment');
const {getParser} = require('../modules/parsers');

const COLLECTION_NAME = 'parse';
const ITEM_NAME = 'parseLink';
const ITEMS_NAME = 'parseLinks';

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
        let pipeline = [
            { $match: {'deleted': {$in: [null, false]}} },
            { $lookup: {
                    from: 'parsedPrices',
                    let: {'parse_id': '$_id'},
                    as: 'lastParsed',
                    pipeline: [
                        { $addFields: {eq: {$eq: ['$$parse_id', '$watchId']}} },
                        { $match: {eq: true} },
                        { $project: {eq: 0} },
                        { $sort: {parsed: -1} },
                        { $limit: 1 }
                    ]
                } },
            { $unwind: {path: '$lastParsed', preserveNullAndEmptyArrays: true} },
        ];

        if (Object.keys(sort).length > 0) {
            pipeline.push({ $sort: sort });
        }

        if (offset > 0) {
            pipeline.push({ $skip: offset });
        }

        if (limit !== -1) {
            pipeline.push({ $limit: limit });
        }

        let cursor = db.collection(COLLECTION_NAME)
            .aggregate(pipeline);

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
    async variants(ctx) {
        let url = ctx.request.body.url || false;
        if (!url) {
            ctx.body = {variants: false};
            return;
        }

        let parser = getParser(url);
        let variants = await parser.getVariants(url);

        ctx.body = {variants};
    }
}