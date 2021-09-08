import axios from "axios";
import clone from "lodash.clonedeep";
import moment from "moment";
import {normalizeDate, splitIntoChunks} from "../utils.mjs";

const API_BASE_URL = 'https://myshop-bmb974.myinsales.ru/';
const MAX_PER_PAGE = 100;

export class InSales {
    constructor(apiId = null, apiPassword = null) {
        this.apiId = apiId;
        this.apiPassword = apiPassword;
    }

    async fetchProducts() {
        let loadNextPage = false;
        let page = 1;
        let allProducts = [];
        do {
            let data = await this.callGetMethod('admin/products.json', {page});
            loadNextPage = data && data.length > 0;
            page++;
            allProducts = allProducts.concat(data);
        } while (loadNextPage)

        return allProducts;
    }

    async fetchOptions() {
        let data = await this.callGetMethod('admin/option_names.json');
        return data;
    }

    async fetchOrders(dateFrom = false) {
        let defaultDate = moment().startOf('d');
        dateFrom = normalizeDate(dateFrom, defaultDate);

        let loadNextPage = false;
        let page = 1;
        let allOrders = [];

        do {
            let pageOrders = await this.callGetMethod('admin/orders.json', {
                updated_since: dateFrom.toISOString(),
                per_page: MAX_PER_PAGE,
                page,
            });
            loadNextPage = pageOrders && pageOrders.length > 0;
            page++;
            allOrders = allOrders.concat(pageOrders);
        } while (loadNextPage)

        return allOrders;
    }

    async addProductWithVariant(newProduct, newVariant, collectionId) {
        let product = clone(newProduct);
        product.variants_attributes = [newVariant];

        let response = await this.callPostMethod('admin/products.json', {product});
        let createdProduct = response && response.id
            ? response
            : null;

        if (createdProduct && collectionId) {
            await this.callPostMethod('admin/collects.json', {
                "collect": {
                    "collection_id": collectionId,
                    "product_id": createdProduct.id
                }
            })
        }

        return createdProduct;
    }

    async addVariantToProduct(product, variant) {
        let productId = product.id;
        return this.callPostMethod(`admin/products/${productId}/variants.json`, {variant});
    }

    async updateMultiplePricesOrQuantities(variants) {
        return this.callPutMethod('admin/products/variants_group_update.json', {variants});
    }

    apiAuth() {
        return {
            username: this.apiId,
            password: this.apiPassword
        }
    }

    async callGetMethod(method, params) {
        let url = API_BASE_URL + method;
        try {
            let response = await axios.get(url, {params, auth: this.apiAuth()});
            return response.data;
        }
        catch (e) {
            return null;
        }
    }

    async callPostMethod(method, params) {
        let url = `${API_BASE_URL}/${method}`;
        let response = await axios.post(url, params, {auth: this.apiAuth()});
        return response.data;
    }

    async callPutMethod(method, params) {
        let url = `${API_BASE_URL}/${method}`;
        let response = await axios.put(url, params, {auth: this.apiAuth()});
        return response.data;
    }

    makeDbProductFromOrderLine(orderLine, key) {
        return {
            source: 'insales',
            sourceType: 'orderLine',
            keyId: key.id,

            id: orderLine.product_id,
            sku: orderLine.sku,
            color: null,
            size: {
                ru: null,
                de: null
            },
            variant: orderLine.variant_id,
            title: orderLine.title,
            brand: null,
            barcode: orderLine.barcode,
            quantity: orderLine.quantity,
            price: parseInt( orderLine.full_total_price * 100)
        }
    }

    findOptionWithValue(optionId, optionValues) {
        if (optionId instanceof Array) {
            return optionValues.find(optionValue => optionId.indexOf(optionValue.option_name_id) !== -1);
        }

        return optionValues.find(optionValue => optionValue.option_name_id === optionId);
    }

    makeDbProductFromVariant(variant, optionIds, key) {
        let colorOption = optionIds && optionIds.color
            ? this.findOptionWithValue(optionIds.color, variant.option_values) || null
            : null;

        let ruSizeOption = optionIds && optionIds.sizeRu
            ? this.findOptionWithValue(optionIds.sizeRu, variant.option_values) || null
            : null;

        let deSizeOption = optionIds && optionIds.sizeDe
            ? this.findOptionWithValue(optionIds.sizeDe, variant.option_values) || null
            : null;

        return {
            source: 'insales',
            sourceType: 'variant',
            keyId: key.id,

            id: variant.product_id,
            sku: variant.sku,
            color: colorOption ? colorOption.title : null,
            size: {
                ru: ruSizeOption ? ruSizeOption.title : null,
                de: deSizeOption ? deSizeOption.title : null
            },
            variant: variant.id,
            title: variant.title,
            brand: null,
            barcode: variant.barcode,
            quantity: variant.quantity,
            price: Math.round(parseFloat(variant.price) * 100)
        }
    }

    findProductByFunction(matchFunction, insalesProducts) {
        for (let insalesProduct of insalesProducts) {
            let matchingVariants = insalesProduct.variants.filter(matchFunction);

            let hasVariantWithMatchingByField = matchingVariants && matchingVariants.length > 0;
            if (hasVariantWithMatchingByField) {
                let matchingProduct = clone(insalesProduct);
                delete matchingProduct.variants;
                matchingProduct.variant = matchingVariants[0];

                return matchingProduct;
            }
        }

        return null;
    }

    findProductByVariantField(fieldName, fieldValue, insalesProducts, fullMatch = true) {
        let matchFunction = variant => {
            return fullMatch
                ? variant[fieldName] === fieldValue
                : variant[fieldName].indexOf(fieldValue) === 0;
        }

        return this.findProductByFunction(matchFunction, insalesProducts)
    }

    matchProducts(dbProducts, insalesProducts, options) {
        let sizeOptionIds = options
            .filter(option => option.title.toLowerCase().indexOf('размер') !== -1)
            .map(option => option.id);

        let matched = [];
        let missingInDb = [];
        let missingInInsales = [];

        for (let dbProduct of dbProducts) {
            let matchedProduct = this.findProductByVariantField('barcode', dbProduct.barcode, insalesProducts);
            if (!matchedProduct) {
                let skuMatchFunction = variant => {
                    if (variant.sku === '' || dbProduct.sku === '') {
                        return false;
                    }

                    if (variant.sku.indexOf(dbProduct.sku) !== 0) {
                        return false;
                    }

                    if (dbProduct.size.ru === "" && dbProduct.size.de === "") {
                        return false;
                    }

                    let sizes = variant.option_values
                        .filter(optionValue => sizeOptionIds.indexOf(optionValue.option_name_id) !== -1)
                        .map(optionValue => optionValue.title.replace(/ .*$/, ''))

                    let ruSizeMatches = dbProduct.size.ru !== "" && sizes.indexOf(dbProduct.size.ru) !== -1;
                    let deSizeMatches = dbProduct.size.de !== "" && sizes.indexOf(dbProduct.size.de) !== -1;
                    let hasMatchingSizes = ruSizeMatches || deSizeMatches;

                    return hasMatchingSizes;
                }

                matchedProduct = this.findProductByFunction(skuMatchFunction, insalesProducts);
            }

            if (matchedProduct) {
                matched.push({
                    db: dbProduct,
                    product: matchedProduct,
                    variant: matchedProduct.variant,
                });
            }
            else {
                missingInInsales.push(dbProduct);
            }
        }

        return {matched, missingInDb, missingInInsales};
    }

    async syncLeftovers(dbStocks) {
        const MAX_VARIANTS_PER_REQUEST = 100;

        if (dbStocks.length === 0) {
            return true;
        }

        let insalesProducts = await this.fetchProducts();
        let options = await this.fetchOptions();

        let {matched: matchedProducts} = this.matchProducts(dbStocks, insalesProducts, options);
        let variants = matchedProducts.map(matched => ({
            id: matched.variant.id,
            quantity: matched.db.quantity,
        }));

        let errorIds = [];
        let variantChunks = splitIntoChunks(variants, MAX_VARIANTS_PER_REQUEST);
        for (let chunk of variantChunks) {
            let result = await this.updateMultiplePricesOrQuantities(chunk);
            for (let variantResult of result) {
                if (variantResult.status !== 'ok') {
                    errorIds.push(variantResult.id);
                }
            }
        }

        return errorIds.length === 0 ? null : errorIds;
    }

    async getMatchedStocks(dbStocks, key) {
        let insalesProducts = await this.fetchProducts();
        let options = await this.fetchOptions();
        if (!options) {
            options = [];
        }

        let ruSizeOptionIds = options
            .filter(option => {
                let lcTitle = option.title.toLowerCase();
                return lcTitle.indexOf('размер') !== -1 && lcTitle.indexOf('ru') !== -1;
            })
            .map(option => option.id);
        let deSizeOptionIds = options
            .filter(option => {
                let lcTitle = option.title.toLowerCase();
                return lcTitle.indexOf('размер') !== -1 && lcTitle.indexOf('de') !== -1;
            })
            .map(option => option.id);
        let colorOptionIds = options
            .filter(option => option.title.toLowerCase().indexOf('цвет') !== -1)
            .map(option => option.id);

        let neededOptionIds = {
            color: colorOptionIds,
            sizeRu: ruSizeOptionIds,
            sizeDe: deSizeOptionIds,
        }

        let insalesStocks = insalesProducts.reduce((stocks, product) => {
            if (product && product.variants) {
                let variants = product.variants.map(variant => this.makeDbProductFromVariant(variant, neededOptionIds, key));
                stocks = stocks.concat(variants);
            }
            return stocks;
        }, []);

        return insalesStocks;
    }
}