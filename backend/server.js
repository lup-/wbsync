const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const stock = require('./routes/stock');
const order = require('./routes/order');
const key = require('./routes/key');
const users = require('./routes/users');
const job = require('./routes/job');

const PORT = 3000;
const HOST = '0.0.0.0';

const app = new Koa();
const router = new Router();

router
    .post('/api/stock/list', stock.list.bind(stock))
    .post('/api/stock/match', stock.match.bind(stock))
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