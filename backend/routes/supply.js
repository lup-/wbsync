const {getDb} = require('../modules/Database');
const {prepareProducts, syncProducts} = require('../modules/Product');
const shortid = require('shortid');
const moment = require('moment');
const iconv = require('iconv-lite');

const COLLECTION_NAME = 'supplies';
const ITEM_NAME = 'supply';
const ITEMS_NAME = 'supplies';

function parseCsvFile(text, separator = ',') {
    //https://stackoverflow.com/a/41563966
    let prevChar = '';
    let row = [''];
    let result = [row];
    let cellIndex = 0;
    let rowIndex = 0;
    let isSeparatorOpen = true;
    let char = null;

    for (char of text) {
        if (char === '"') {
            if (isSeparatorOpen && char === prevChar) {
                row[cellIndex] += char;
            }
            isSeparatorOpen = !isSeparatorOpen;
        }
        else if (separator === char && isSeparatorOpen) {
            ++cellIndex;
            char = '';
            row[cellIndex] = '';
        }
        else if (char === '\n' && isSeparatorOpen) {
            if (prevChar === '\r') {
                row[cellIndex] = row[cellIndex].slice(0, -1);
            }

            ++rowIndex;
            char = '';
            row = [''];
            result[rowIndex] = row;
            cellIndex = 0;
        }
        else {
            row[cellIndex] += char;
        }
        prevChar = char;
    }
    return result;
}
async function prepareCsv(file, supplyType) {
    let csvBuffer = file.buffer;
    let rawCsv = iconv.decode(csvBuffer, supplyType.codepage);
    let parsedCsv = parseCsvFile(rawCsv, supplyType.separator);

    if (supplyType.skipCsvLines > 0) {
        parsedCsv.splice(0, supplyType.skipCsvLines);
    }

    if (supplyType.hasHeader) {
        parsedCsv.splice(0, 1);
    }

    return {rawCsv, parsedCsv};
}
function parseProducts(csv, supplyType, productType) {
    let fieldMappings = Object.keys(supplyType.dataMap).map(key => {
        return {columnNumber: key, fieldCode: supplyType.dataMap[key]};
    });

    let products = [];
    for (let row of csv) {
        let isEmptyRow = !row || (row && row.length === 0) || (row && row.length === 1 && row[0] === '');
        if (isEmptyRow) {
            continue;
        }

        let product = {};
        for (let mapping of fieldMappings) {
            let field = productType.fields.find(field => mapping.fieldCode === field.code);
            let fieldIsMapped = typeof (field) !== 'undefined';
            if (fieldIsMapped) {
                let columnNumber = mapping.columnNumber;
                let value  = row[columnNumber];

                if (field.type === 'price' || field.type === 'number') {
                    try {
                        value = parseFloat(value);
                    }
                    catch (e) {
                        value = null;
                    }
                }

                if (field.type === 'quantity') {
                    try {
                        value = parseInt(value);
                    }
                    catch (e) {
                        value = null;
                    }
                }

                if (field.multiple) {
                    if (typeof (product[field.code]) === 'undefined') {
                        product[field.code] = [];
                    }

                    product[field.code].push(value);
                }
                else {
                    product[field.code] = value;
                }
            }
        }

        for (let field of productType.fields) {
            if (typeof (product[field.code]) === 'undefined') {
                product[field.code] = null;
            }
        }

        products.push(product);
    }

    return products;
}
function addSupplyId(products, supplyId) {
    return products.map(product => {
        product.supplyId = supplyId;
        return product;
    });
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
            .aggregate([
                {$match: filter},
                {$project: {rawCsv: 0, parsedCsv: 0}}
            ]);

        if (Object.keys(sort).length > 0) {
            cursor = cursor.sort(sort);
        }

        if (offset) {
            cursor = cursor.skip(offset);
        }

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
    async listProducts(ctx) {
        let itemFields = ctx.request.body[ITEM_NAME];
        let supplyId = itemFields.id;

        let sort = ctx.request.body && ctx.request.body.sort
            ? ctx.request.body.sort || {}
            : {};

        let limit = ctx.request.body.limit ? parseInt(ctx.request.body.limit) : null;
        let offset = ctx.request.body.offset ? parseInt(ctx.request.body.offset) : 0;

        let filter = {
            'supplyId': supplyId,
            'deleted': {$in: [null, false]}
        };

        let db = await getDb();
        let cursor = db.collection('supplyProducts')
            .aggregate([
                {$match: filter},
                {$project: {rawCsv: 0, parsedCsv: 0}}
            ]);

        if (Object.keys(sort).length > 0) {
            cursor = cursor.sort(sort);
        }

        if (offset) {
            cursor = cursor.skip(offset);
        }

        if (limit !== -1) {
            cursor = cursor.limit(limit);
        }

        let items = await cursor.toArray();

        let totalCount = await db.collection('supplyProducts').countDocuments(filter);
        let supplyType = await db.collection('supplyTypes').findOne({id: itemFields.supplyTypeId});
        let productType = await db.collection('productTypes').findOne({id: supplyType.productTypeId});

        let response = {};
        response['supplyProducts'] = items;
        response['supply'] = itemFields;
        response['supplyType'] = supplyType;
        response['productType'] = productType;
        response['totalCount'] = totalCount;

        ctx.body = response;
    },
    async accept(ctx) {
        let supply = ctx.request.body.supply;
        let options = ctx.request.body.options;
        if (!supply) {
            ctx.body = {supply: false}
            return;
        }

        let db = await getDb();
        let filter = {
            'supplyId': supply.id,
            'deleted': {$in: [null, false]}
        };

        let supplyProducts = await db.collection('supplyProducts')
            .aggregate([
                {$match: filter},
                {$project: {rawCsv: 0, parsedCsv: 0}}
            ])
            .toArray();
        let fullSupply = await db.collection('supplies').findOne({id: supply.id});

        let hasProducts = supplyProducts && supplyProducts.length > 0;
        let supplyType = await db.collection('supplyTypes').findOne({id: supply.supplyTypeId});
        let productType = await db.collection('productTypes').findOne({id: supplyType.productTypeId});
        if (!hasProducts && fullSupply.parsedCsv && fullSupply.parsedCsv.length > 0) {
            let products = parseProducts(fullSupply.parsedCsv, supplyType, productType);
            products = addSupplyId(products, fullSupply.id);

            await db.collection('supplyProducts').insertMany(products);
            supplyProducts = await db.collection('supplyProducts')
                .aggregate([
                    {$match: filter},
                    {$project: {rawCsv: 0, parsedCsv: 0}}
                ])
                .toArray();
        }

        let syncResult = false;
        let error = false;
        if (hasProducts) {
            let products = prepareProducts(supplyProducts, productType)
                .filter(product => product.barcode && product.barcode.length > 0);

            if (products && products.length > 0) {
                try {
                    syncResult = await syncProducts(db, products, supply, productType, options);
                    await db.collection('supplies').updateOne({id: supply.id}, {$set: {
                        accepted: moment().unix(),
                        acceptOptions: options,
                    }});
                    supply = await db.collection('supplies').findOne({id: supply.id});
                }
                catch (e) {
                    error = e.toString();
                }
            }
            else {
                error = 'В поставке не найдены товары со штрихкодами';
            }
        }
        else {
            error = 'В поставке не найдены подходящие товары';
        }

        ctx.body = {supply, productType, syncResult, error}
    },
    async add(ctx) {
        let file = ctx.file;
        let itemFields = ctx.request.body;
        if (itemFields._id) {
            let response = {};
            response[ITEM_NAME] = false;

            ctx.body = response;
            return;
        }

        const db = await getDb();
        let supplyTypeId = itemFields.supplyTypeId;
        let supplyType = await db.collection('supplyTypes').findOne({id: supplyTypeId});
        let productType = await db.collection('productTypes').findOne({id: supplyType.productTypeId});

        let {rawCsv, parsedCsv} = await prepareCsv(file, supplyType);
        let products = parseProducts(parsedCsv, supplyType, productType);

        let supplyId = shortid.generate();
        itemFields = Object.assign(itemFields, {
            id: supplyId,
            rawCsv,
            parsedCsv,
            created: moment().unix(),
            updated: moment().unix(),
        });

        let result = await db.collection(COLLECTION_NAME).insertOne(itemFields);
        let supply = result.ops[0];
        products = addSupplyId(products, supplyId);

        let productResults = await db.collection('supplyProducts').insertMany(products);

        let response = {};
        response[ITEM_NAME] = supply;
        response['products'] = productResults.ops;

        ctx.body = response;
    },
    async update(ctx) {
        const db = await getDb();

        let file = ctx.file;
        let itemFields = ctx.request.body;
        let id = itemFields.id;

        if (itemFields._id) {
            delete itemFields._id;
        }

        let products = null;
        let additionalUpdatedFields = {
            updated: moment().unix(),
        };

        let savedProducts = await db.collection('supplyProducts').find({supplyId: itemFields.id}).toArray();

        let supplyTypeId = itemFields.supplyTypeId;
        let supplyType = await db.collection('supplyTypes').findOne({id: supplyTypeId});
        let productType = await db.collection('productTypes').findOne({id: supplyType.productTypeId});

        if (file) {
            let {rawCsv, parsedCsv} = await prepareCsv(file, supplyType);
            products = parseProducts(parsedCsv, supplyType, productType);
            products = addSupplyId(products, itemFields.id);
            additionalUpdatedFields = Object.assign(additionalUpdatedFields, {
                rawCsv,
                parsedCsv
            });
        }
        else if (savedProducts.length === 0 && itemFields.parsedCsv && itemFields.parsedCsv.length > 0) {
            products = parseProducts(itemFields.parsedCsv, supplyType, productType);
            products = addSupplyId(products, itemFields.id);
        }

        itemFields = Object.assign(itemFields, additionalUpdatedFields);

        let updateResult = await db.collection(COLLECTION_NAME).findOneAndReplace({id}, itemFields, {returnOriginal: false});
        let item = updateResult.value || false;

        let response = {};
        response[ITEM_NAME] = item;

        if (products) {
            await db.collection('supplyProducts').deleteMany({supplyId: id});
            let productResults = await db.collection('supplyProducts').insertMany(products);

            response['products'] = productResults.ops;
        }

        ctx.body = response;
    },
    async delete(ctx) {
        const db = await getDb();

        let itemFields = ctx.request.body[ITEM_NAME];
        let id = itemFields.id;

        let updateResult = await db.collection(COLLECTION_NAME).findOneAndUpdate({id}, {$set: {deleted: moment().unix()}}, {returnOriginal: false});
        await db.collection('supplyProducts').deleteMany({supplyId: id});

        let item = updateResult.value || false;
        let response = {};
        response[ITEM_NAME] = item;

        ctx.body = response;
    }
}