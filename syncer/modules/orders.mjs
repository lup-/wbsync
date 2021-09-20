import moment from "moment";
import createDebug from "debug";
import {Wildberries} from "./wildberries/index.mjs";
import {InSales} from "./insales/index.mjs";
import {Ozon} from "./ozon/index.mjs";
import {getDb, syncCollectionItems} from "./database.mjs";
import {getUniqueCodeByProps} from "./utils.mjs";
import clone from "lodash.clonedeep";

const FULL_UPDATE = process.env['FULL_UPDATE'] === "1";
const debug = createDebug('syncer:orders');

async function getDateFrom(source, db) {
    let dateFrom = moment().startOf('y');
    if (!FULL_UPDATE) {
        let lastOrder;

        try {
            [lastOrder] = await db.collection('orders').aggregate([
                {$match: {source}},
                {$sort: {updated: -1}},
                {$limit: 1}
            ]).toArray();
        }
        catch (e) {
            lastOrder = false;
        }

        if (lastOrder) {
            dateFrom = moment.unix(lastOrder.updated);
        }
    }

    return dateFrom;
}

function makeDbProductsFromWildberriesV1(wbv1Order) {
    return [{
        id: null,
        sku: wbv1Order.supplierArticle,
        color: null,
        size: {
            ru: wbv1Order.techSize,
            de: null
        },
        variant: null,
        title: wbv1Order.subject,
        brand: wbv1Order.brand,
        barcode: wbv1Order.barcode,
        quantity: wbv1Order.quantity,
        price: parseInt( wbv1Order.totalPrice * 100)
    }];
}
function makeDbProductsFromWildberriesSaleV1(wbv1Sale) {
    return [{
        id: null,
        sku: wbv1Sale.supplierArticle,
        color: null,
        size: {
            ru: wbv1Sale.techSize,
            de: null
        },
        variant: null,
        title: wbv1Sale.subject,
        brand: wbv1Sale.brand,
        barcode: wbv1Sale.barcode,
        quantity: wbv1Sale.quantity,
        price: parseInt( wbv1Sale.totalPrice * 100)
    }];
}
function makeDbProductsFromWildberriesV2(wbv2Order) {
    let wb = new Wildberries();
    return wb.makeDbProductsFromOrderV2(wbv2Order);
}
function makeDbProductsFromInsales(insalesOrder, key) {
    let insales = new InSales();
    return insalesOrder.order_lines.map(orderLine => insales.makeDbProductFromOrderLine(orderLine, key))
}
function makeDbProductsFromOzon(ozonOrder, ozonProducts) {
    let ozon = new Ozon();
    return ozonOrder.products.map(orderProduct => {
        let dbProduct = ozon.makeDbProduct(orderProduct);
        let ozonProduct = ozonProducts.find(product => product.title === dbProduct.title && product.sku === dbProduct.sku);
        if (ozonProduct) {
            dbProduct.barcode = ozonProduct.barcode;
        }

        return dbProduct;
    });
}

function makeDbOrderFromWildberriesV1(wbv1Order, key) {
    return {
        source: 'wildberries',
        sourceType: 'v1',
        orderType: 'ORDER',
        keyId: key.id,

        id: parseInt( wbv1Order.number !== 0 ? wbv1Order.number : wbv1Order.odid ),
        updated: moment(wbv1Order.lastChangeDate).unix(),
        created: moment(wbv1Order.date).unix(),
        canceled: wbv1Order.isCancel ? moment(wbv1Order.cancel_dt).unix() : false,
        status: null,
        statusText: null,
        price: parseInt( wbv1Order.totalPrice * 100),

        products: makeDbProductsFromWildberriesV1(wbv1Order),

        raw: wbv1Order
    }
}
function makeDbOrderFromWildberriesV2(wbv2Order, key) {
    let statusTexts = {
        0: "Новый заказ",
        1: "Принял заказ",
        2: "Сборочное задание завершено",
        3: "Сборочное задание отклонено",
        5: "На доставке курьером",
        6: "Курьер довез и клиент принял товар",
        7: "Клиент не принял товар"
    }

    let userStatusText = {
        1: "Отмена клиента",
        2: "Доставлен",
        3: "Возврат",
        4: "Ожидает",
        5: "Брак"
    }

    let isCanceled = wbv2Order.userStatus === 1 || wbv2Order.userStatus === 3 || wbv2Order.userStatus === 5;
    let dateCreated = moment(wbv2Order.dateCreated).unix();

    return {
        source: 'wildberries',
        sourceType: 'v2',
        orderType: 'FBS',
        keyId: key.id,

        id: wbv2Order.orderId,
        updated: dateCreated,
        created: dateCreated,
        canceled: isCanceled ? dateCreated : false,
        status: wbv2Order.status,
        statusText: statusTexts[wbv2Order.status],
        price: wbv2Order.totalPrice,

        products: makeDbProductsFromWildberriesV2(wbv2Order),

        raw: wbv2Order
    }
}
function makeDbOrderFromWildberriesSalesV1(wbv1Sale, key) {
    return {
        source: 'wildberries',
        sourceType: 'v1',
        orderType: 'SALE',
        keyId: key.id,

        id: wbv1Sale.saleID,
        updated: moment(wbv1Sale.lastChangeDate).unix(),
        created: moment(wbv1Sale.date).unix(),
        canceled: null,
        status: null,
        statusText: null,
        price: parseInt( wbv1Sale.finishedPrice * 100),

        products: makeDbProductsFromWildberriesSaleV1(wbv1Sale),

        raw: wbv1Sale
    }
}
function makeDbOrderFromInsales(insalesOrder, key) {
    let isFBO = insalesOrder.client && insalesOrder.client.name && insalesOrder.client.name === 'FBO';
    let isReturned = insalesOrder.fulfillment_status === 'returned';

    return {
        source: 'insales',
        sourceType: insalesOrder.first_source,
        orderType: isFBO ? 'FBO' : 'FBS',
        keyId: key.id,

        id: insalesOrder.number,
        updated: moment(insalesOrder.updated_at).unix(),
        created: moment(insalesOrder.created_at).unix(),
        canceled: isReturned ? moment(insalesOrder.updated_at).unix() : false,
        status: insalesOrder.custom_status ? insalesOrder.custom_status.permalink : null,
        statusText: insalesOrder.custom_status ? insalesOrder.custom_status.title : null,
        price: parseInt(insalesOrder.total_price * 100),

        products: makeDbProductsFromInsales(insalesOrder, key),

        raw: insalesOrder
    }
}
function makeDbOrderFromOzon(ozonOrder, key, ozonProducts) {
    let ozon = new Ozon();
    let products = makeDbProductsFromOzon(ozonOrder, ozonProducts);
    let totalPrice = products.reduce((price, product) => price + product.price, 0);

    return {
        source: 'ozon',
        sourceType: null,
        orderType: 'FBS',
        keyId: key.id,

        id: ozonOrder.order_number,
        updated: moment(ozonOrder.in_process_at).unix(),
        created: moment(ozonOrder.in_process_at).unix(),
        canceled: ozonOrder.status === 'cancelled' ? moment().unix() : false,
        status: ozonOrder.status,
        statusText: ozon.statusText(ozonOrder.status),
        price: totalPrice,

        products,

        raw: ozonOrder
    }
}

function joinObjects(object1, object2) {
    let joinedObject = clone(object1);

    let allUniqueFields = Object.keys(object1)
        .concat(Object.keys(object2))
        .filter((field, index, allFields) => allFields.indexOf(field) === index);

    for (let field of allUniqueFields) {
        let noField = typeof(joinedObject[field]) === 'undefined' || joinedObject[field] === null;
        if (noField) {
            joinedObject[field] = object2[field];
        }
    }

    return joinedObject;
}
function sameProductByBarcodeOrSku(product1, product2) {
    let hasBarcode = Boolean(product1.barcode) && Boolean(product2.barcode);
    let hasSku = Boolean(product1.sku) && Boolean(product2.sku);

    if (hasBarcode) {
        return product1.barcode === product2.barcode
    }

    if (hasSku) {
        return getUniqueCodeByProps(product1) === getUniqueCodeByProps(product2);
    }

    return false;
}
function joinProducts(products1, products2) {
    let joinedProducts = [];
    let products1ToSync = clone(products1);
    let products2ToSync = clone(products2);

    for (let product1Index=0; product1Index < products1.length; product1Index++) {
        let product1 = products1ToSync[product1Index];

        let product2Index = products2ToSync.findIndex(product2 => sameProductByBarcodeOrSku(product1, product2));

        if (product2Index !== -1) {
            let product2 = products2ToSync[product2Index];
            let sameColor = product1.color === null || product2.color === null
                ? true
                : product1.color === product2.color;

            let product1Size = product1.size && product1.size.ru ? product1.size.ru : null;
            let product2Size = product2.size && product2.size.ru ? product2.size.ru : null;
            let sameSize = product1Size === null || product2Size === null
                ? true
                : product1Size === product2Size;

            let sameProduct = sameColor && sameSize;
            if (sameProduct) {
                let joinedProduct = joinObjects(product1, product2);
                joinedProduct.size = product1.size && product1.size.ru !== null
                    ? product1.size
                    : product2.size;
                joinedProduct.color = product1.color !== null
                    ? product1.color
                    : product2.color;

                joinedProducts.push(joinedProduct);
            }
            else {
                joinedProducts.push(product1);
                joinedProducts.push(product2);
            }

            products1.splice(product1Index, 1);
            products2.splice(product2Index, 1);
        }
    }

    let separateUniqueProducts = products1.concat(products2)
        .filter((product, index, allProducts) => {
            return allProducts.findIndex(searchProduct => sameProductByBarcodeOrSku(product, searchProduct)) === index;
        });

    joinedProducts = joinedProducts.concat(separateUniqueProducts);
    return joinedProducts;
}
function getUniqueValues(field, object1, object2) {
    let value1 = object1[field];
    let value2 = object2[field];
    let value1Type = typeof(value1);
    let value2Type = typeof(value2);

    if (value1Type === 'undefined' && value2Type === 'undefined') {
        return undefined;
    }

    if (value1Type !== 'undefined' && value2Type === 'undefined') {
        return value1;
    }

    if (value1Type === 'undefined' && value2Type !== 'undefined') {
        return value2;
    }

    let result = [];

    if (value1 instanceof Array || value2 instanceof Array) {
        if (value1 instanceof Array) {
            result = result.concat(value1);
        }
        else {
            result.push(value1);
        }

        if (value2 instanceof Array) {
            result = result.concat(value2);
        }
        else {
            result.push(value2);
        }
    }
    else {
        result.push(value1);
        result.push(value2);
    }

    let uniqueResult = result
        .filter(value => value !== null)
        .filter((value, index, all) => all.indexOf(value) === index);

    return uniqueResult.length === 1
        ? uniqueResult[0]
        : uniqueResult;
}
function joinOrderFields(order1, order2) {
    let joinedOrder = joinObjects(order1, order2);
    joinedOrder.products = joinProducts(order1.products, order2.products);
    joinedOrder.sourceType = getUniqueValues('sourceType', order1, order2);
    joinedOrder.orderType = getUniqueValues('orderType', order1, order2);
    joinedOrder.raw = getUniqueValues('raw', order1, order2);
    joinedOrder.price = order1.price + order2.price;
    joinedOrder.quantity = order1.quantity + order2.quantity;

    if (order1.sourceType === 'v1' && order2.sourceType === 'v2') {
        joinedOrder.price = order2.price;
    }

    if (order1.sourceType === 'v2' && order2.sourceType === 'v1') {
        joinedOrder.price = order1.price;
    }

    return joinedOrder;
}
function joinByArray(orders) {
    let joinedOrders = [];
    let processedIndexes = [];
    for (let srcOrderIndex=0; srcOrderIndex < orders.length; srcOrderIndex++) {
        if (processedIndexes.indexOf(srcOrderIndex) !== -1) {
            continue;
        }

        processedIndexes.push(srcOrderIndex);

        let srcOrder = orders[srcOrderIndex];
        let joinedOrder = clone(srcOrder);
        let duplicateIndex = null;

        while (duplicateIndex !== -1) {
            duplicateIndex = orders.findIndex((duplicateOrder, duplicateIndex) => {
                return srcOrder.id === duplicateOrder.id && processedIndexes.indexOf(duplicateIndex) === -1;
            });

            if (duplicateIndex !== -1) {
                processedIndexes.push(duplicateIndex);

                let duplicateOrder = orders[duplicateIndex];
                joinedOrder = joinOrderFields(joinedOrder, duplicateOrder);
            }
        }

        joinedOrders.push(joinedOrder);
    }

    return joinedOrders;
}

async function syncJoinedWBOrders(key, db) {
    let wbv1Key = key.wb_64bit;
    let wbv2Key = key.wb_new;

    let wb = new Wildberries(wbv1Key, wbv2Key);
    let source = 'wildberries';

    let dateFrom = await getDateFrom(source, db);
    let dateTo = moment().endOf('d');
    let ordersV1 = await wb.getOrdersV1(dateFrom) || [];
    let salesV1 = await wb.getSalesV1(dateFrom) || [];
    let ordersV2 = await wb.getOrdersV2(dateFrom, dateTo) || [];
    let preparedOrdersV1 = ordersV1
        // .filter(orderV1 => orderV1.number !== 0)
        .map(order => makeDbOrderFromWildberriesV1(order, key));
    let preparedSalesV1 = salesV1.map(sale => makeDbOrderFromWildberriesSalesV1(sale, key));
    let preparedOrdersV2 = ordersV2.map(order => makeDbOrderFromWildberriesV2(order, key));
    let joinedOrders = joinByArray(preparedOrdersV1.concat(preparedOrdersV2).concat(preparedSalesV1));
    let beforeUpdate = (updatedOrder, savedOrder) => {
        if (updatedOrder.sourceType === 'v2') {
            updatedOrder.updated = moment().unix();
            if (savedOrder.canceled === false && updatedOrder.canceled !== false) {
                updatedOrder.canceled = moment().unix();
            }
        }

        return updatedOrder;
    }
    return syncCollectionItems(db, joinedOrders, 'orders', 'id', 'status', beforeUpdate);
}
async function syncInsalesOrders(key, db) {
    let insales = new InSales(key.insales_api_id, key.insales_api_password);
    let source = 'insales';

    let dateFrom = await getDateFrom(source, db);
    let orders = await insales.fetchOrders(dateFrom)
    let preparedOrders = orders.filter(order => Boolean(order)).map(order => makeDbOrderFromInsales(order, key));
    return syncCollectionItems(db, preparedOrders, 'orders', 'id', 'updated');
}
async function syncOzonOrders(key, db) {
    let ozon = new Ozon(key.client_id, key.api_key);
    let source = 'ozon';

    let dateFrom = await getDateFrom(source, db);
    let orders = await ozon.fetchOrders(dateFrom);
    let ozonProducts = await db.collection('stock').find({keyId: key.id}).toArray();

    let preparedOrders = orders.filter(order => Boolean(order)).map(order => makeDbOrderFromOzon(order, key, ozonProducts));

    let beforeUpdate = (updatedOrder, savedOrder) => {
        updatedOrder.updated = moment().unix();
        return updatedOrder;
    }

    return syncCollectionItems(db, preparedOrders, 'orders', 'id', 'status', beforeUpdate);
}

async function updateWbOrdersInDb(keys, db) {
    for (let key of keys) {
        debug('Syncing %s', key.title);
        await syncJoinedWBOrders(key, db);
    }
}
async function updateInsalesOrdersInDb(keys, db) {
    for (let key of keys) {
        debug('Syncing %s', key.title);
        await syncInsalesOrders(key, db);
    }
}
async function updateOzonOrdersInDb(keys, db) {
    for (let key of keys) {
        debug('Syncing %s', key.title);
        await syncOzonOrders(key, db);
    }
}

async function syncAllOrders(debug) {
    debug('Starting orders sync');
    debug('Full update mode %s', FULL_UPDATE);
    let db = await getDb();
    let keys = await db.collection('keys').find({deleted: {$in: [null, false]}}).toArray();
    let wbKeys = keys.filter(key => key.type === 'wildberries');
    let insalesKeys = keys.filter(key => key.type === 'insales');
    let ozonKeys = keys.filter(key => key.type === 'ozon');

    if (wbKeys.length > 0) {
        await updateWbOrdersInDb(wbKeys, db);
    }

    if (insalesKeys.length > 0) {
        await updateInsalesOrdersInDb(insalesKeys, db);
    }

    if (ozonKeys.length > 0) {
        await updateOzonOrdersInDb(ozonKeys, db);
    }

    await db.collection('log').insertOne({
        type: 'syncAllOrders',
        date: moment().unix(),
        fullUpdate: FULL_UPDATE,
    });

    debug('Done!');
}

export {syncAllOrders}