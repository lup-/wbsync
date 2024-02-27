import axios from "axios";
import moment from "moment";
import createDebug from "debug";
import {matchByBarcode, normalizeDate, splitIntoChunks} from "../utils.mjs";
import {Product} from "../dbProduct.mjs";

const API_BASE = 'https://suppliers-stats.wildberries.ru/api/v1/';
const API_V2_BASE = 'https://suppliers-api.wildberries.ru/api/v2/';
const API_V3_BASE = 'https://suppliers-api.wildberries.ru/api/v3/';
const CONTENT_V2_BASE = 'https://suppliers-api.wildberries.ru/content/v2/';

const API_V2_ORDERS_MAX_CHUNK_SIZE = 1000;
const API_V2_STOCKS_UPLOAD_MAX_CHUNK_SIZE = 100;

const API_V3_STOCKS_MAX_CHUNK_SIZE = 1000;


const debug = createDebug('wildberries');

export class Wildberries {
    constructor(apiV1Key = null, apiV2Key = null) {
        this.apiV1Key = apiV1Key;
        this.apiV2Key = apiV2Key;
        this.apiV3Key = apiV2Key;
    }

    async callV1Api(method, params = {}) {
        if (!this.apiV1Key && !params.key) {
            throw new Error('Ключ для API v1 не задан');
        }

        if (!params.key) {
            params.key = this.apiV1Key;
        }

        let url = `${API_BASE}${method}`;

        try {
            let response = await axios.get(url, {params});
            return response.data;
        }
        catch (e) {
            debug(e);
        }
    }

    async callV2Api(method, params = {}) {
        if (!this.apiV2Key) {
            throw new Error('Ключ для API v2 не задан');
        }

        let url = `${API_V2_BASE}${method}`;

        try {
            let response = await axios.get(url, {
                headers: {
                    authorization: this.apiV2Key,
                },
                params
            });

            return response.data;
        }
        catch (e) {
            debug(e);
        }
    }

    async callV3Api(method, params = {}) {
        if (!this.apiV3Key) {
            throw new Error('Ключ для API v3 не задан');
        }

        let url = `${API_V3_BASE}${method}`;

        try {
            let response = await axios.get(url, {
                headers: {
                    Authorization: this.apiV3Key,
                },
                params
            });

            return response.data;
        }
        catch (e) {
            debug(e);
        }
    }

    async postV3Api(method, params = {}) {
        if (!this.apiV3Key) {
            throw new Error('Ключ для API v3 не задан');
        }

        let url = `${API_V3_BASE}${method}`;

        try {
            let response = await axios.post(url, params, {
                headers: {
                    Authorization: this.apiV3Key,
                }
            });

            return response.data;
        }
        catch (e) {
            debug(e);
        }
    }

    async putV3Api(method, params = {}) {
        if (!this.apiV3Key) {
            throw new Error('Ключ для API v3 не задан');
        }

        let url = `${API_V3_BASE}${method}`;

        try {
            let response = await axios.put(url, params, {
                headers: {
                    Authorization: this.apiV3Key,
                }
            });

            return response.data;
        }
        catch (e) {
            debug(e);
        }
    }

    async postContentApi(method, params = {}) {
        if (!this.apiV3Key) {
            throw new Error('Ключ для API v3 не задан');
        }

        let url = `${CONTENT_V2_BASE}${method}`;

        try {
            let response = await axios.post(url, params, {
                headers: {
                    authorization: this.apiV3Key,
                }
            });

            return response.data;
        }
        catch (e) {
            debug(e);
        }
    }

    normalizeDate(someDate, defaultDate) {
        return normalizeDate(someDate, defaultDate);
    }

    async getOrdersV2(dateFrom = false, dateTo = false) {
        let defaultDate = moment().startOf('d');
        dateFrom = this.normalizeDate(dateFrom, defaultDate);
        dateTo = this.normalizeDate(dateTo, dateFrom.clone().add('1', 'd'));

        let loadNextPage = false;
        let page = 1;
        let allOrders = [];

        do {
            let v2params = {
                date_start: dateFrom.toISOString(),
                date_end: dateTo.toISOString(),
                take: API_V2_ORDERS_MAX_CHUNK_SIZE,
                skip: allOrders.length,
            }

            let ordersResponse = await this.callV2Api('orders', v2params);
            let pageOrders = ordersResponse && ordersResponse.orders
                ? ordersResponse.orders
                : null;

            loadNextPage = pageOrders && pageOrders.length > 0;
            page++;
            if (pageOrders) {
                allOrders = allOrders.concat(pageOrders);
            }
        } while (loadNextPage)

        return allOrders && allOrders.length > 0
            ? allOrders
            : null;
    }

    async getOrdersV3(dateFrom = false, dateTo = false) {
        let defaultDate = moment().startOf('d');
        dateFrom = this.normalizeDate(dateFrom, defaultDate);
        dateTo = this.normalizeDate(dateTo, dateFrom.clone().add('1', 'd'));

        let loadNextPage = false;
        let page = 1;
        let allOrders = [];

        let params = {
            dateFrom: dateFrom.unix(),
            dateTo: dateTo.unix(),
            limit: API_V2_ORDERS_MAX_CHUNK_SIZE,
            next: 0,
        }

        do {
            let ordersResponse = await this.callV3Api('orders', params);
            let pageOrders = ordersResponse && ordersResponse.orders
                ? ordersResponse.orders
                : null;

            if (pageOrders && pageOrders.length > 0) {
                let orderIds = pageOrders.map(order => order.id);
                let statusesResponse = await this.postV3Api('orders/status', {
                    orders: orderIds,
                });

                if (statusesResponse.orders && statusesResponse.orders.length > 0) {
                    let statusesHash = statusesResponse.orders.reduce((hash, statusData) => {
                        if (statusData && statusData.id) {
                            hash[statusData.id] = statusData.wbStatus;
                        }
                        return hash;
                    }, {});
                    pageOrders = pageOrders.map(order => {
                        if (statusesHash[order.id]) {
                            order.status = statusesHash[order.id];
                        }
                        return order;
                    });
                }
            }

            loadNextPage = pageOrders && pageOrders.length > 0;
            page++;
            params.next = ordersResponse.next;
            if (pageOrders) {
                allOrders = allOrders.concat(pageOrders);
            }
        } while (loadNextPage)

        return allOrders && allOrders.length > 0
            ? allOrders
            : null;
    }

    getProductFromOrder(order) {
        let productFields = ['supplierArticle', 'techSize', 'barcode', 'odid', 'subject', 'category', 'brand'];
        let wbProduct = productFields.reduce((product, field) => {
            product[field] = order[field];
            return product;
        }, {});

        wbProduct.price = order.totalPrice / order.quantity;

        return wbProduct;
    }

    async fetchProducts() {
        let loadNextPage = false;
        let page = 1;
        let allProducts = [];
        let warehouses = await this.getWarehouses();
        let warehouse = warehouses ? warehouses[0] : null;
        let warehouseId = warehouse?.id || null;

        if (!warehouseId) {
            return [];
        }

        let cursor = {
            limit: API_V3_STOCKS_MAX_CHUNK_SIZE
        }

        let filter = {
            withPhoto: -1
        }

        do {
            let productsResponse = await this.postContentApi('get/cards/list', {
                settings: {cursor, filter}
            });

            let products = productsResponse?.cards || [];

            if (products.length > 0) {
                products = products.reduce((all, product) => {
                    for (let size of product.sizes) {
                        let newProduct = Object.assign({}, product);
                        newProduct.size = size;
                        all.push(newProduct);
                    }
                    return all;
                }, []);

                let skus = products.map(product => product?.size?.skus[0]);
                let skuChunks = splitIntoChunks(skus, API_V3_STOCKS_MAX_CHUNK_SIZE);
                let allStocks = [];
                for (let chunk of skuChunks) {
                    let stockData = await this.postV3Api('stocks/' + warehouseId, {skus});
                    let stocks = stockData.stocks || [];
                    if (stocks && stocks.length > 0) {
                        allStocks = allStocks.concat(stocks);
                    }
                }

                let stocksHash = allStocks.reduce((hash, stock) => {
                    if (stock) {
                        hash[stock.sku] = stock?.amount || 0;
                    }

                    return hash;
                }, {});

                products = products.map(product => {
                    let sku = product?.size?.skus[0];
                    product.amount = sku
                        ? stocksHash[sku] || 0
                        : 0;
                    return product;
                });
            }

            loadNextPage = products && products.length > 0;
            page++;
            cursor.updatedAt = productsResponse?.cursor?.updatedAt;
            cursor.nmID = productsResponse?.cursor?.nmID;

            if (products) {
                allProducts = allProducts.concat(products);
            }
        } while (loadNextPage);

        return allProducts;
    }

    makeDbProductsFromOrderV3(wbv3Order) {
        let product = new Product({
            id: wbv3Order.nmId,
            barcode: wbv3Order.skus[0],
            price: wbv3Order.price / 100,
            quantity: 1,
        });
        product.setRaw('v3order', wbv3Order);

        return [product.getJson()];
    }

    makeDbProductsFromStocksV3(wbv3Stocks, key) {
        let product = new Product({
            source: 'wildberries',
            sourceType: 'v3',
            keyId: key.id,

            id: wbv3Stocks.nmID,
            size: {ru: wbv3Stocks.size?.wbSize},
            barcode: wbv3Stocks.size?.skus[0],
            quantity: wbv3Stocks.amount,
            brand: wbv3Stocks.brand,
            title: wbv3Stocks.subjectName,
            sku: wbv3Stocks.size?.skus[0],
        });
        product.setRaw('v3stocks', wbv3Stocks);

        return product.getJson();
    }

    async fetchStocksForDb(key) {
        let wbProducts = await this.fetchProducts();
        let wbStocks = wbProducts.map(product => this.makeDbProductsFromStocksV3(product, key));

        return wbStocks;
    }

    async getWarehouses() {
        try {
            let data = await this.callV3Api('warehouses', {});
            return data;
        }
        catch (e) {
            return [];
        }
    }

    matchProducts(sourceProducts, wildberriesProducts) {
        let matched = [];

        for (let sourceProduct of sourceProducts) {
            let matchedWbProducts = matchByBarcode(sourceProduct, wildberriesProducts);
            if (matchedWbProducts && matchedWbProducts.length > 0) {
                for (let wbProduct of matchedWbProducts) {
                    matched.push({
                        source: sourceProduct,
                        target: wbProduct,
                    });
                }
            }
        }

        return matched;
    }

    updateQuantities(stocks, warehouseId) {
        return this.putV3Api('stocks/'+warehouseId, stocks);
    }

    async syncLeftovers(isDbSync, fromStocks, toStocks) {
        let matchedStocks = this.matchProducts(fromStocks, toStocks);
        let warehouses = await this.getWarehouses();
        let targetWarehouse = warehouses[0];

        let allStocks = matchedStocks.map(matched => ({
            sku: matched.target.barcode,
            amount: matched.source.quantity,
        }));

        let errors = [];
        let stocksChunks = splitIntoChunks(allStocks, API_V2_STOCKS_UPLOAD_MAX_CHUNK_SIZE);
        for (let chunk of stocksChunks) {
            try {
                await this.updateQuantities({
                    stocks: chunk
                }, targetWarehouse.id);
            }
            catch (e) {
                errors.push(e.toString());
            }
        }

        return errors.length === 0 ? null : errors;
    }
}

