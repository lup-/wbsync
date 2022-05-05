const Koa = require('koa');
const Router = require('@koa/router');
const multer = require('@koa/multer');
const bodyParser = require('koa-bodyparser');

const stock = require('./routes/stock');
const order = require('./routes/order');
const key = require('./routes/key');
const users = require('./routes/users');
const job = require('./routes/job');
const productType = require('./routes/productType');
const supplyType = require('./routes/supplyType');
const exportType = require('./routes/exportType');
const product = require('./routes/product');
const supply = require('./routes/supply');
const parse = require('./routes/parse');

const {checkAndParseNewItems, setRepeatingTask} = require('./modules/Parser');
const startParserQueueProcessing = require('./job');

const PORT = 3000;
const HOST = '0.0.0.0';

const app = new Koa();
const router = new Router();
const upload = multer();

router
    .post('/api/parse/list', parse.list.bind(parse))
    .post('/api/parse/add', parse.add.bind(parse))
    .post('/api/parse/update', parse.update.bind(parse))
    .post('/api/parse/delete', parse.delete.bind(parse))
    .post('/api/parse/variants', parse.variants.bind(parse));

router
    .post('/api/productType/list', productType.list.bind(productType))
    .post('/api/productType/add', productType.add.bind(productType))
    .post('/api/productType/update', productType.update.bind(productType))
    .post('/api/productType/delete', productType.delete.bind(productType));

router
    .post('/api/supplyType/list', supplyType.list.bind(supplyType))
    .post('/api/supplyType/add', supplyType.add.bind(supplyType))
    .post('/api/supplyType/update', supplyType.update.bind(supplyType))
    .post('/api/supplyType/delete', supplyType.delete.bind(supplyType));

router
    .post('/api/exportType/list', exportType.list.bind(exportType))
    .post('/api/exportType/add', exportType.add.bind(exportType))
    .post('/api/exportType/update', exportType.update.bind(exportType))
    .post('/api/exportType/delete', exportType.delete.bind(exportType))
    .post('/api/export', exportType.exportProducts.bind(exportType));

router
    .post('/api/supply/list', supply.list.bind(supply))
    .post('/api/supply/listProducts', supply.listProducts.bind(supply))
    .post('/api/supply/accept', supply.accept.bind(supply))
    .post('/api/supply/add', upload.single('file'), supply.add.bind(supply))
    .post('/api/supply/update', upload.single('file'), supply.update.bind(supply))
    .post('/api/supply/delete', supply.delete.bind(supply));

router
    .post('/api/product/list', product.list.bind(product))
    .post('/api/product/add', product.add.bind(product))
    .post('/api/product/update', product.update.bind(product))
    .post('/api/product/delete', product.delete.bind(product));

router
    .post('/api/stock/list', stock.list.bind(stock))
    .post('/api/stock/match', stock.match.bind(stock))
    .post('/api/stock/matchWithProducts', stock.matchWithProducts.bind(stock))
    .post('/api/stock/add', stock.add.bind(stock))
    .post('/api/stock/update', stock.update.bind(stock))
    .post('/api/stock/delete', stock.delete.bind(stock));

router
    .post('/api/order/list', order.list.bind(order))
    .post('/api/order/add', order.add.bind(order))
    .post('/api/order/update', order.update.bind(order))
    .post('/api/order/delete', order.delete.bind(order))
    .get('/api/order/filters', order.filters.bind(order));

router
    .post('/api/key/list', key.list.bind(key))
    .post('/api/key/add', key.add.bind(key))
    .post('/api/key/update', key.update.bind(key))
    .post('/api/key/delete', key.delete.bind(key));

router
    .post('/api/user/list', users.list.bind(users))
    .post('/api/user/add', users.add.bind(users))
    .post('/api/user/update', users.update.bind(users))
    .post('/api/user/delete', users.delete.bind(users))
    .post('/api/user/check', users.check.bind(users))
    .post('/api/user/login', users.login.bind(users));

router
    .post('/api/job/stocks', job.syncStocks.bind(job))
    .post('/api/job/orders', job.syncOrders.bind(job))
    .post('/api/job/parser', job.parser.bind(job))
    .post('/api/job/status', job.status.bind(job))
    .get('/api/job/last', job.lastJobs.bind(job));

app
    .use(async (ctx, next) => {
        ctx.request.socket.setTimeout(5 * 60 * 1000);
        await next();
    })
    .use(bodyParser({
        formLimit: '50mb',
        jsonLimit: '1mb',
    }))
    .use(router.routes())
    .use(router.allowedMethods());

let server = app.listen(PORT, HOST);
server.setTimeout(5*60*1000);
server.timeout=5*60*1000;

setRepeatingTask(checkAndParseNewItems, 600, true);
startParserQueueProcessing();