import axios from "axios";
import createDebug from "debug";
import {normalizeDate} from "../utils.mjs";
import moment from "moment";

const API_BASE='https://api-seller.ozon.ru/';
const debug = createDebug('ozon');

const API_MAX_CHUNK_SIZE = 50;

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
                    limit: API_MAX_CHUNK_SIZE,
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
}