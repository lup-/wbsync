const he = require('he');
const got = require('got');
const { JSDOM } = require("jsdom");
const moment = require("moment");
const Iconv = require('iconv').Iconv;
const {getDb} = require('./Database');
const {parseWatchItem} = require('./parsers');

function trimHTML(html) {
    return he.decode(html)
        .replace(/<!\-\-.*?\-\->/ig, '')
        .replace(/<\/*[a-z]+.*?>/ig, '')
        .replace(/ +/g, ' ')
        .replace(/\t+/g, '\t')
        .trim();
}
function innerText(element) {
    if (element) {
        return trimHTML(element.innerHTML || '');
    }

    return '';
}

function getHost(link) {
    if (link.indexOf('http') !== 0) {
        link = 'https://'+link;
    }

    try {
        let url = new URL(link);
        return url.hostname.toLowerCase() || false;
    }
    catch (e) {
        return  false;
    }
}
async function parseUrl(url, queries, cookieJar = false, ua = false, agent = false, skipSSLCheck = false) {
    let params = {
        responseType: 'buffer',
        timeout: {
            request: 15000,
            response: 15000,
        },
        retry: {
            limit: 1
        }
    };
    if (cookieJar) {
        params.cookieJar = cookieJar;
    }

    if (ua) {
        params.headers = {
            'user-agent': ua
        }
    }

    if (agent) {
        params.agent = {http: agent, https: agent};
    }

    let tlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (skipSSLCheck) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const response = await got(url, params);
    if (typeof (tlsReject) !== "undefined") {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = tlsReject;
    }

    let html = response.body.toString();

    let charsetSearch = html.match(/\<meta[^>]*?charset=['"]*([a-zA-Z\-0-9]+)['"]/i);
    let charset = charsetSearch && charsetSearch[1] ? charsetSearch[1].toLowerCase() : 'utf-8';

    if (charset !== 'utf-8') {
        let conv = Iconv(charset, 'utf-8//ignore');
        html = conv.convert(response.body).toString();
    }

    const { document } = (new JSDOM(html, {contentType: 'text/html; charset=utf-8'})).window;

    let parsedData = cookieJar ? {cookieJar} : {};

    for (const key in queries) {
        const selector = queries[key];

        if (typeof selector === 'function') {
            parsedData[key] = selector(document);
        }
        else {
            const el = document.querySelector(selector);
            parsedData[key] = el.innerHTML;
        }
    }

    return parsedData;
}

function setRepeatingTask(taskFn, periodSecs, callOnStart = false) {
    let repeatInterval = setInterval(taskFn, periodSecs * 1000);
    if (callOnStart) {
        taskFn();
    }
    return repeatInterval;
}
async function checkAndParseNewItems() {
    let db = await getDb();
    let now = moment().unix();
    let allItems = await db.collection('parse').aggregate([
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
        { $addFields: {nextParse: {$sum: ['$lastParsed.parsed', {$multiply: [3600, '$period']}]}} },
        { $match: {'nextParse': {$lte: now}} }
    ]).toArray();

    let parsedProductsCount = [];
    for (let item of allItems) {
        let products = await parseWatchItem(item);
        await db.collection('parsedPrices').insertOne({
            watchId: item._id,
            parsed: moment().unix(),
            products
        });

        parsedProductsCount.push({
            watchId: item._id,
            productsCount: products.length,
        });
    }

    return parsedProductsCount;
}

async function checkAndParseAllItems() {
    let db = await getDb();
    let allItems = await db.collection('parse').find({'deleted': {$in: [null, false]}}).toArray();

    let parsedProductsCount = [];
    for (let item of allItems) {
        let products = await parseWatchItem(item);
        await db.collection('parsedPrices').insertOne({
            watchId: item._id,
            parsed: moment().unix(),
            products
        });

        parsedProductsCount.push({
            watchId: item._id,
            productsCount: products.length,
        });
    }

    return parsedProductsCount;
}

module.exports = {getHost, parseUrl, checkAndParseNewItems, checkAndParseAllItems, setRepeatingTask, innerText}