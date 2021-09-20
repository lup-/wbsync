import axios from "axios";
import moment from "moment";
import createDebug from "debug";
import {matchByBarcode, normalizeDate, splitIntoChunks} from "../utils.mjs";
import {Product} from "../dbProduct.mjs";

const API_BASE = 'https://suppliers-stats.wildberries.ru/api/v1/';
const API_V2_BASE = 'https://suppliers-api.wildberries.ru/api/v2/';

const API_V2_ORDERS_MAX_CHUNK_SIZE = 1000;
const API_V2_STOCKS_MAX_CHUNK_SIZE = 1000;
const API_V2_STOCKS_UPLOAD_MAX_CHUNK_SIZE = 100;

const debug = createDebug('wildberries');

export class Wildberries {
    constructor(apiV1Key = null, apiV2Key = null) {
        this.apiV1Key = apiV1Key;
        this.apiV2Key = apiV2Key;
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

    async postV2Api(method, params = {}) {
        if (!this.apiV2Key) {
            throw new Error('Ключ для API v2 не задан');
        }

        let url = `${API_V2_BASE}${method}`;

        try {
            let response = await axios.post(url, params, {
                headers: {
                    authorization: this.apiV2Key,
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

    async getOrdersV1(dateFrom = false, useUpdateDate = true) {
        let defaultDate = moment().startOf('d');
        dateFrom = this.normalizeDate(dateFrom, defaultDate);

        let v1params = {
            dateFrom: dateFrom.toISOString(),
            flag: useUpdateDate ? 0 : 1
        }

        return this.callV1Api('supplier/orders', v1params);
    }

    async getSalesV1(dateFrom = false, useUpdateDate = true) {
        let defaultDate = moment().startOf('d');
        dateFrom = this.normalizeDate(dateFrom, defaultDate);

        let v1params = {
            dateFrom: dateFrom.toISOString(),
            flag: useUpdateDate ? 0 : 1
        }

        return this.callV1Api('supplier/sales', v1params);
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

    async getAllFBSOrders(dateFrom) {
        let allOrders = await this.getOrdersV1(dateFrom);
        return allOrders ? allOrders.filter(order => order.number === 0) : allOrders;
    }

    async getActiveFBSOrders(date) {
        return this.getOrdersV2(date)
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
        let allStocks = [];
        do {
            let data = await this.callV2Api('stocks', {
                take: API_V2_STOCKS_MAX_CHUNK_SIZE,
                skip: allStocks.length,
            });

            let pageStocks = data && data.stocks
                ? data.stocks
                : null;

            loadNextPage = pageStocks && pageStocks.length > 0;
            page++;
            if (pageStocks) {
                allStocks = allStocks.concat(pageStocks);
            }
        } while (loadNextPage);

        return allStocks;
    }

    makeDbProductsFromOrderV2(wbv2Order) {
        let product = new Product({
            id: wbv2Order.barcode,
            barcode: wbv2Order.barcode,
            price: wbv2Order.totalPrice,
        });
        product.setRaw('v2order', wbv2Order);

        return [product.getJson()];
    }

    makeDbProductsFromStocksV2(wbv2Stocks, key) {
        let product = new Product({
            source: 'wildberries',
            sourceType: 'v2',
            keyId: key.id,

            id: wbv2Stocks.barcode,
            size: {de: wbv2Stocks.size},
            barcode: wbv2Stocks.barcode,
            quantity: wbv2Stocks.stock,
            brand: wbv2Stocks.brand,
            title: wbv2Stocks.name,
            sku: wbv2Stocks.article,
        });
        product.setRaw('v2stocks', wbv2Stocks);

        return product.getJson();
    }

    async fetchStocksForDb(key) {
        let wbProducts = await this.fetchProducts();
        let wbStocks = wbProducts.map(product => this.makeDbProductsFromStocksV2(product, key));

        return wbStocks;
    }

    async getWarehouses() {
        try {
            let data = await this.callV2Api('warehouses', {});
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

    updateQuantities(stocks) {
        return this.postV2Api('stocks', stocks);
    }

    async syncLeftovers(fromStocks, toStocks) {
        let matchedStocks = this.matchProducts(fromStocks, toStocks);
        let warehouses = await this.getWarehouses();
        let targetWarehouse = warehouses[0];

        let allStocks = matchedStocks.map(matched => ({
            barcode: matched.target.barcode,
            stock: matched.source.quantity,
            warehouseId: targetWarehouse.id
        }));

        let errors = [];
        let stocksChunks = splitIntoChunks(allStocks, API_V2_STOCKS_UPLOAD_MAX_CHUNK_SIZE);
        for (let chunk of stocksChunks) {
            let result = await this.updateQuantities(chunk);
            if (result.error === true) {
                errors = errors.concat(result.data.errors);
            }
        }

        return errors.length === 0 ? null : errors;
    }
}

