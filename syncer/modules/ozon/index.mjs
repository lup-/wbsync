import axios from "axios";
import createDebug from "debug";
import {normalizeDate, matchByBarcodeOrSku, matchByBarcode, splitIntoChunks} from "../utils.mjs";
import {Product} from "../dbProduct.mjs";
import moment from "moment";

const API_BASE='https://api-seller.ozon.ru/';
const debug = createDebug('ozon');

const API_MAX_ORDERS_CHUNK_SIZE = 50;
const API_MAX_STOCKS_CHUNK_SIZE = 100;
const API_MAX_INFO_CHUNK_SIZE = 1000;

export class Ozon {
    constructor(clientId = null, apiKey = null) {
        this.clientId = clientId
        this.apiKey = apiKey;
    }

    statues() {
        return [
            {code: "acceptance_in_progress", text: "идёт приёмка"},
            {code: "awaiting_approve", text: "ожидает подтверждения"},
            {code: "awaiting_packaging", text: "ожидает упаковки"},
            {code: "awaiting_deliver", text: "ожидает отгрузки"},
            {code: "arbitration", text: "арбитраж"},
            {code: "client_arbitration", text: "клиентский арбитраж доставки"},
            {code: "delivering", text: "доставляется"},
            {code: "driver_pickup", text: "у водителя"},
            {code: "delivered", text: "доставлено"},
            {code: "cancelled", text: "отменено"},
            {code: "not_accepted", text: "не принят на сортировочном центре"},
        ]
    }

    statusCodes() {
        return this.statues().map(status => status.code);
    }

    statusText(code) {
        let status = this.statues().find(status => status.code === code);
        return status ? status.text : null;
    }

    async callGetMethod(method, params = {}) {
        if (!this.apiKey) {
            throw new Error('Ключ для API не задан');
        }

        let url = `${API_BASE}${method}`;

        try {
            let response = await axios.get(url, {
                headers: {
                    'Client-Id': this.clientId,
                    'Api-Key': this.apiKey,
                },
                params
            });

            return response.data;
        }
        catch (e) {
            debug(e);
        }
    }

    async callPostMethod(method, params = {}) {
        if (!this.apiKey) {
            throw new Error('Ключ для API не задан');
        }

        let url = `${API_BASE}${method}`;

        try {
            let response = await axios.post(url, params, {
                headers: {
                    'Client-Id': this.clientId,
                    'Api-Key': this.apiKey,
                },
            });

            return response.data;
        }
        catch (e) {
            debug(e);
        }

        return null;
    }

    makeDbProduct(ozonProduct) {
        let product = new Product({
            id: ozonProduct.sku,
            sku: ozonProduct.offer_id,
            title: ozonProduct.name,
            quantity: ozonProduct.quantity,
            price: Math.floor(parseFloat(ozonProduct.price) * 100),
        });

        return product.getJson();
    }

    makeDbProductFromStock(ozonProduct, key) {
        let fbsStocks = ozonProduct.stocks.find(stock => stock.type === 'fbs');
        let product = new Product({
            source: 'ozon',
            keyId: key.id,

            id: ozonProduct.product_id,
            sku: ozonProduct.offer_id,
            quantity: fbsStocks ? fbsStocks.present : 0,
        });
        product.setRaw('stock', ozonProduct);

        return product.getJson();
    }

    addProductPropsToStockProps(stock, ozonProduct) {
        let product = new Product(stock);
        product.setFields({
            title: ozonProduct.name,
            barcode: ozonProduct.barcode,
            price: Math.floor( parseFloat(ozonProduct.price) * 100 ),
        });
        product.setRaw('product', ozonProduct);

        return product.getJson();
    }

    async fetchProducts() {
        let loadNextPage = false;
        let page = 1;
        let allProducts = [];
        do {
            let data = await this.callPostMethod('v2/product/info/stocks', {
                page_size: API_MAX_INFO_CHUNK_SIZE,
                page: page-1
            });

            if (data && data.result) {
                page++;
                allProducts = allProducts.concat(data.result.items);
                loadNextPage = allProducts.length < data.result.total;
            }
            else {
                loadNextPage = false;
            }

        } while (loadNextPage);

        return allProducts;
    }

    async fetchStocksForDb(key) {
        let ozonProducts = await this.fetchProducts();
        let ozonStocks = ozonProducts.map(product => this.makeDbProductFromStock(product, key));

        let products = [];
        for (let stock of ozonStocks) {
            try {
                let data = await this.callPostMethod('v2/product/info', {
                    product_id: stock.id
                });

                if (data && data.result) {
                    products.push(this.addProductPropsToStockProps(stock, data.result));
                }
            }
            catch (e) {
                debug(e);
            }
        }

        return products;
    }

    async fetchOrders(dateFrom = null, dateTo = null) {
        let defaultDate = moment().startOf('d');
        dateFrom = normalizeDate(dateFrom, defaultDate);
        dateTo = normalizeDate(dateTo, moment().endOf('d'));

        let allOrders = [];

        for (let status of this.statusCodes()) {
            let statusOrders = [];
            let loadNextPage = false;
            let page = 1;

            do {
                let query = {
                    dir: "desc",
                    filter: {
                        since: dateFrom.toISOString(),
                        to: dateTo.toISOString(),
                        status,
                    },
                    limit: API_MAX_ORDERS_CHUNK_SIZE,
                    offset: statusOrders.length,
                    with: {
                        barcodes: true,
                        financial_data: true
                    }
                }

                let ordersResponse = await this.callPostMethod('v3/posting/fbs/list', query);
                let pageOrders = ordersResponse && ordersResponse.result && ordersResponse.result.postings
                    ? ordersResponse.result.postings
                    : null;

                loadNextPage = ordersResponse && ordersResponse.result && ordersResponse.result.has_next;
                page++;
                if (pageOrders) {
                    statusOrders = statusOrders.concat(pageOrders);
                }
            } while (loadNextPage)
            if (statusOrders && statusOrders.length > 0) {
                allOrders = allOrders.concat(statusOrders);
            }
        }

        return allOrders && allOrders.length > 0
            ? allOrders
            : null;
    }

    matchProducts(sourceProducts, ozonProducts) {
        let matched = [];

        for (let sourceProduct of sourceProducts) {
            let matchedOzonProducts = matchByBarcodeOrSku(sourceProduct, ozonProducts);
            if (matchedOzonProducts && matchedOzonProducts.length > 0) {
                for (let ozonProduct of matchedOzonProducts) {
                    matched.push({
                        source: sourceProduct,
                        target: ozonProduct,
                    });
                }
            }
        }

        return matched;
    }

    matchDbProducts(dbProducts, ozonProducts) {
        let matched = [];

        for (let sourceProduct of dbProducts) {
            let matchedOzonProducts = matchByBarcode(sourceProduct, ozonProducts);
            if (matchedOzonProducts && matchedOzonProducts.length > 0) {
                for (let ozonProduct of matchedOzonProducts) {
                    matched.push({
                        source: sourceProduct,
                        target: ozonProduct,
                    });
                }
            }
        }

        return matched;
    }

    updateQuantities(stocks) {
        return this.callPostMethod('v1/product/import/stocks', {stocks});
    }

    async syncLeftovers(isDbSync, fromStocks, toStocks) {
        let matchedStocks = [];
        if (isDbSync) {
            matchedStocks = this.matchDbProducts(fromStocks, toStocks);
        }
        else {
            matchedStocks = this.matchProducts(fromStocks, toStocks);
        }

        let allStocks = matchedStocks.map(matched => ({
            offer_id: matched.target.sku,
            product_id: matched.target.id,
            stock: matched.source.quantity,
        }));

        let errors = [];
        let stocksChunks = splitIntoChunks(allStocks, API_MAX_STOCKS_CHUNK_SIZE);
        for (let chunk of stocksChunks) {
            let {result} = await this.updateQuantities(chunk);
            for (let productResult of result) {
                if (productResult.errors && productResult.errors.length > 0) {
                    errors = errors.concat(productResult.errors);
                }
            }
        }

        return errors.length === 0 ? null : errors;
    }
}