const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const stock = require('./routes/stock');
const order = require('./routes/order');
const key = require('./routes/key');
const users = require('./routes/users');

const PORT = 3000;
const HOST = '0.0.0.0';

const app = new Koa();
const router = new Router();

router
    .post('/api/stock/list', stock.list.bind(stock))
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

app
    .use(bodyParser({
        formLimit: '50mb',
        jsonLimit: '1mb',
    }))
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(PORT, HOST);