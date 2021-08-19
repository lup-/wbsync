import moment from "moment";
import createDebug from "debug";
import {Wildberries} from "./modules/wildberries/index.mjs";
import {getDb, syncCollectionItems} from "./modules/database.mjs";

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
        sku: wbv1Order.supplierArticle,
        color: null,
        size: {
            ru: wbv1Order.techSize,
            de: null
        },
        title: wbv1Order.subject,
        barcode: wbv1Order.barcode,
        quantity: wbv1Order.quantity
    }];
}
function makeDbProductsFromWildberriesV2(wbv2Order) {
    return [{
        sku: null,
        color: null,
        size: {
            ru: null,
            de: null
        },
        title: null,
        barcode: wbv2Order.barcode,
        quantity: null
    }];
}

function makeDbOrderFromWildberriesV1(wbv1Order, key) {
    return {
        source: 'wildberries',
        sourceType: 'v1',
        orderType: wbv1Order.number === 0 ? 'FBS' : 'FBO',
        keyId: key.id,

        id: parseInt( wbv1Order.number !== 0 ? wbv1Order.number : wbv1Order.nmId ),
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

    return {
        source: 'wildberries',
        sourceType: 'v2',
        orderType: 'FBS',
        keyId: key.id,

        id: wbv2Order.orderId,
        updated: moment().unix(),
        created: moment(wbv2Order.dateCreated).unix(),
        canceled: isCanceled ? moment().unix() : false,
        status: wbv2Order.status,
        statusText: statusTexts[wbv2Order.status],
        price: wbv2Order.totalPrice,

        products: makeDbProductsFromWildberriesV2(wbv2Order),

        raw: wbv2Order
    }
}

async function syncWBAllOrders(key, db) {
    let wbv1Key = key.wb_64bit;
    let wbv2Key = key.wb_new;

    let wb = new Wildberries(wbv1Key, wbv2Key);
    let source = 'wildberries';

    let dateFrom = await getDateFrom(source, db);
    let orders = await wb.getOrdersV1(dateFrom) || [];
    let preparedOrders = orders.map(order => makeDbOrderFromWildberriesV1(order, key));
    return syncCollectionItems(db, preparedOrders, 'orders', 'id', 'updated');
}
async function syncWBFBSOrders(key, db) {
    let wbv1Key = key.wb_64bit;
    let wbv2Key = key.wb_new;

    let wb = new Wildberries(wbv1Key, wbv2Key);
    let source = 'wildberries';

    let dateFrom = await getDateFrom(source, db);
    let dateTo = moment().endOf('d');
    let orders = await wb.getOrdersV2(dateFrom, dateTo) || [];
    let preparedOrders = orders.map(order => makeDbOrderFromWildberriesV2(order, key));
    return syncCollectionItems(db, preparedOrders, 'orders', 'id', 'status');
}

async function updateWbOrdersInDb(keys, db) {
    for (let key of keys) {
        debug('Syncing %s', key.title);
        await syncWBAllOrders(key, db);
        await syncWBFBSOrders(key, db);
    }
}

(async () => {
    debug('Starting orders sync');
    debug('Full update mode %s', FULL_UPDATE);
    let db = await getDb();
    let keys = await db.collection('keys').find({deleted: {$in: [null, false]}}).toArray();
    await updateWbOrdersInDb(keys, db);
    debug('Done!');
    process.exit();
})();