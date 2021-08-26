import axios from "axios";
import moment from "moment";
import createDebug from "debug";
import {normalizeDate} from "../utils.mjs";

const API_BASE = 'https://suppliers-stats.wildberries.ru/api/v1/';
const API_V2_BASE = 'https://suppliers-api.wildberries.ru/api/v2/';

const API_V2_ORDERS_MAX_CHUNK_SIZE = 1000;

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

        let v2params = {
            date_start: dateFrom.toISOString(),
            date_end: dateTo.toISOString(),
            take: API_V2_ORDERS_MAX_CHUNK_SIZE,
            skip: 0
        }

        let ordersResponse = await this.callV2Api('orders', v2params);
        return ordersResponse && ordersResponse.orders
            ? ordersResponse.orders
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
}

