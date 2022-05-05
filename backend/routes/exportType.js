const {getDb} = require('../modules/Database');
const shortid = require('shortid');
const moment = require('moment');
const iconv = require("iconv-lite");

const COLLECTION_NAME = 'exportTypes';
const ITEM_NAME = 'exportType';
const ITEMS_NAME = 'exportTypes';

function getExportedFields(product, exportType, fields) {
    let exportedFields = [];
    let takeFromSupply = exportType.takeFromSupply || [];
    for (let field of fields) {
        let fieldCode = field.code;
        let value = product[fieldCode] || product.props[fieldCode] || null;
        if (takeFromSupply.includes(fieldCode)) {
            value = product.supply[fieldCode] || null;
        }

        if (value instanceof Array) {
            value = value.join(', ');
        }

        if (!value) {
            value = '';
        }

        exportedFields.push(value);
    }

    return exportedFields;
}
function aggregateSupplyProducts(products, productTypes) {
    let aggregatedFieldCodes = [];
    if (productTypes) {
        for (let productType of productTypes) {
            if (productType.fields) {
                for (let field of productType.fields) {
                    if (field.type === 'quantity') {
                        aggregatedFieldCodes.push(field.code);
                    }
                }
            }
        }
    }

    let productsWithAggregatedSupply = [];
    for (let product of products) {
        let aggregatedSupply = {};

        if (product.supply && product.supply.length > 0) {
            aggregatedSupply = Object.assign({}, product.supply[0]);
            for (let code of aggregatedFieldCodes) {
                aggregatedSupply[code] = 0;
            }

            for (let supplyItem of product.supply) {
                for (let code of aggregatedFieldCodes) {
                    aggregatedSupply[code] += supplyItem[code];
                }
            }
        }

        product.supply = aggregatedSupply;
        productsWithAggregatedSupply.push(product);
    }

    return productsWithAggregatedSupply;
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
    async exportProducts(ctx) {
        const db = await getDb();
        let options = ctx.request.body.options || {};
        let exportTypeId = options.exportTypeId;

        if (!exportTypeId) {
            ctx.body = {success: false, error: 'Не указан ID типа экспорта'};
            return;
        }

        let exportType = await db.collection('exportTypes').findOne({id: exportTypeId});
        if (!exportType) {
            ctx.body = {success: false, error: 'Не найден тип экспорта'};
            return;
        }

        let supplyId = options.supply
            ? options.supply.id || null
            : null;

        let supplyTypes = exportType.supplyTypeId
            ? await db.collection('supplyTypes').find({id: exportType.supplyTypeId}).toArray()
            : null;
        let productTypes = exportType.productTypeId
            ? await db.collection('productTypes').find({id: exportType.productTypeId}).toArray()
            : await db.collection('productTypes').find().toArray();

        let pipeline = [];
        if (exportType.productTypeId) {
            pipeline.push({$match: {productTypeId: exportType.productTypeId}});
        }

        if (supplyId) {
            pipeline.push({$lookup: {
                from: 'supplyProducts',
                let: {srcBarcodes: '$barcode'},
                as: "supply",
                pipeline: [
                    { $match: {supplyId: supplyId} },
                    { $addFields: {
                            dstBarcodes: { $cond:
                                    {
                                        if: { $isArray: "$barcode" },
                                        then: "$barcode",
                                        else: ["$barcode"]
                                    }
                            }
                        }},
                    { $addFields: { commonBarcodes:{ $setIntersection: [ "$$srcBarcodes", "$dstBarcodes" ] }} },
                    { $match: {"commonBarcodes.0": { $exists: true }} },
                    { $project: {commonBarcodes: 0, dstBarcodes: 0} }
                ]
            }});

            if (options.onlyInSupply) {
                pipeline.push({ $match: {"supply.0": {$exists: true}} });
            }
        }

        let exportProducts = await db.collection('products').aggregate(pipeline).toArray();
        if (!exportProducts) {
            exportProducts = [];
        }
        exportProducts = aggregateSupplyProducts(exportProducts, productTypes);

        let csvFields = [];
        let allFields = productTypes.reduce((allFields, productType) => {
            return allFields.concat(productType.fields || []);
        }, []);

        let fields = allFields.filter(field => {
            return exportType && exportType.fields && exportType.fields.length > 0
                ? exportType.fields.includes(field.code)
                : true;
        });

        if (exportType.addHeader) {
            let fieldNames = fields.map(field => {
                return field.title;
            });

            csvFields.push(fieldNames);
        }
        for (let product of exportProducts) {
            csvFields.push( getExportedFields(product, exportType, fields) );
        }

        let separator = exportType.separator || ';';
        let csv = [];
        for (let fields of csvFields ) {
            let row = fields.join(separator);
            csv.push(row);
        }
        csv = csv.join('\n');
        if (exportType.codepage && exportType.codepage !== 'utf8') {
            csv = iconv.encode(csv, exportType.codepage);
        }

        ctx.attachment(`export_${moment().unix()}.csv`);
        ctx.statusCode = 200;
        ctx.type = 'text/csv';
        ctx.body = csv;
    }
}