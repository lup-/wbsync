import axios from "axios";
import clone from "lodash.clonedeep";
import moment from "moment";
import {normalizeDate, splitIntoChunks} from "../utils.mjs";
import {Product} from "../dbProduct.mjs";
import createDebug from "debug";

const MAX_PER_PAGE = 100;

const debug = createDebug('syncer:job:insales');

export class InSales {
    constructor(apiId = null, apiPassword = null, apiBaseUrl = null) {
        this.apiId = apiId;
        this.apiPassword = apiPassword;
        this.apiBaseUrl = (apiBaseUrl+'/').replace(/\/\/$/,'/');
        debug('Shop url %s', this.apiBaseUrl);
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
        let url = this.apiBaseUrl + method;
        try {
            let response = await axios.get(url, {params, auth: this.apiAuth()});
            return response.data;
        }
        catch (e) {
            debug('Error calling %s method: %s', method, e);
            return null;
        }
    }

    async callPostMethod(method, params) {
        let url = this.apiBaseUrl + method;
        let response = await axios.post(url, params, {auth: this.apiAuth()});
        return response.data;
    }

    async callPutMethod(method, params) {
        let url = this.apiBaseUrl + method;
        let response = await axios.put(url, params, {auth: this.apiAuth()});
        return response.data;
    }

    makeDbProductFromOrderLine(orderLine, key) {
        let product = new Product({
            source: 'insales',
            sourceType: 'orderLine',
            keyId: key.id,

            id: orderLine.product_id,
            sku: orderLine.sku,
            variant: orderLine.variant_id,
            title: orderLine.title,
            barcode: orderLine.barcode,
            quantity: orderLine.quantity,
            price: parseInt( orderLine.full_total_price * 100)
        });
        product.setRaw('orderLine', orderLine);

        return product.getJson();
    }

    findOptionWithValue(optionId, optionValues) {
        if (optionId instanceof Array) {
            return optionValues.find(optionValue => optionId.indexOf(optionValue.option_name_id) !== -1);
        }

        return optionValues.find(optionValue => optionValue.option_name_id === optionId);
    }

    makeDbProductFromVariant(variant, optionIds, key, insalesProduct) {
        let colorOption = optionIds && optionIds.color
            ? this.findOptionWithValue(optionIds.color, variant.option_values) || null
            : null;

        let ruSizeOption = optionIds && optionIds.sizeRu
            ? this.findOptionWithValue(optionIds.sizeRu, variant.option_values) || null
            : null;

        let deSizeOption = optionIds && optionIds.sizeDe
            ? this.findOptionWithValue(optionIds.sizeDe, variant.option_values) || null
            : null;

        let anySizeOption = optionIds && optionIds.sizeDe
            ? this.findOptionWithValue(optionIds.sizeAny, variant.option_values) || null
            : null;

        let product = new Product({
            source: 'insales',
            sourceType: 'variant',
            keyId: key.id,

            id: variant.id,
            sku: variant.sku,
            color: colorOption ? colorOption.title : null,
            size: {
                ru: ruSizeOption ? ruSizeOption.title : null,
                de: deSizeOption ? deSizeOption.title : null,
                any: anySizeOption ? anySizeOption.title : null,
            },
            product: variant.product_id,
            title: insalesProduct.title + ': ' + variant.title,
            barcode: variant.barcode,
            quantity: variant.quantity,
            price: Math.round(parseFloat(variant.price) * 100)
        });
        product.setRaw('product', insalesProduct);
        product.setRaw('variant', variant);

        return product.getJson();
    }

    findProductsByFunction(matchFunction, insalesProducts) {
        let matchingProducts = [];
        for (let insalesProduct of insalesProducts) {
            let matchingVariants = insalesProduct.variants.filter(matchFunction);

            let hasVariantWithMatchingByField = matchingVariants && matchingVariants.length > 0;
            if (hasVariantWithMatchingByField) {
                let matchingProduct = clone(insalesProduct);
                delete matchingProduct.variants;
                matchingProduct.variant = matchingVariants[0];
                matchingProduct.matchingVariants = matchingVariants;

                matchingProducts.push(matchingProduct);
            }
        }

        return matchingProducts;
    }

    findProductsByVariantField(fieldName, fieldValue, insalesProducts, fullMatch = true) {
        let matchFunction = variant => {
            return fullMatch
                ? variant[fieldName] === fieldValue
                : variant[fieldName].indexOf(fieldValue) === 0;
        }

        return this.findProductsByFunction(matchFunction, insalesProducts)
    }

    matchDbProducts(dbProducts, insalesProducts) {
        let matched = [];
        for (let sourceProduct of dbProducts) {
            let matchedProducts = this.findProductsByVariantField('barcode', sourceProduct.barcode, insalesProducts);
            if (matchedProducts) {
                for (let product of matchedProducts) {
                    for (let variant of product.matchingVariants) {
                        matched.push({
                            db: sourceProduct,
                            product,
                            variant,
                        });
                    }
                }
            }
        }

        return {matched};
    }

    matchProducts(sourceProducts, insalesProducts, options) {
        let sizeOptionIds = options
            .filter(option => option.title.toLowerCase().indexOf('размер') !== -1)
            .map(option => option.id);

        let matched = [];
        let missingInDb = [];
        let missingInInsales = [];

        for (let sourceProduct of sourceProducts) {
            let matchedProducts = this.findProductsByVariantField('barcode', sourceProduct.barcode, insalesProducts);
            if (!matchedProducts) {
                let skuMatchFunction = variant => {
                    if (variant.sku === '' || sourceProduct.sku === '') {
                        return false;
                    }

                    if (variant.sku.indexOf(sourceProduct.sku) !== 0) {
                        return false;
                    }

                    if (sourceProduct.size.ru === "" && sourceProduct.size.de === "") {
                        return false;
                    }

                    let sizes = variant.option_values
                        .filter(optionValue => sizeOptionIds.indexOf(optionValue.option_name_id) !== -1)
                        .map(optionValue => optionValue.title.replace(/ .*$/, ''))

                    let ruSizeMatches = sourceProduct.size.ru !== "" && sizes.indexOf(sourceProduct.size.ru) !== -1;
                    let deSizeMatches = sourceProduct.size.de !== "" && sizes.indexOf(sourceProduct.size.de) !== -1;
                    let hasMatchingSizes = ruSizeMatches || deSizeMatches;

                    return hasMatchingSizes;
                }

                matchedProducts = this.findProductsByFunction(skuMatchFunction, insalesProducts);
            }

            if (matchedProducts) {
                for (let product of matchedProducts) {
                    for (let variant of product.matchingVariants) {
                        matched.push({
                            db: sourceProduct,
                            product,
                            variant,
                        });
                    }
                }
            }
            else {
                missingInInsales.push(sourceProduct);
            }
        }

        return {matched, missingInDb, missingInInsales};
    }

    async syncLeftovers(isDbSync, fromStocks) {
        const MAX_VARIANTS_PER_REQUEST = 100;

        if (fromStocks.length === 0) {
            return true;
        }

        let insalesProducts = await this.fetchProducts();
        let options = await this.fetchOptions();

        let matchedProducts = [];
        if (isDbSync) {
            let {matched} = this.matchDbProducts(fromStocks, insalesProducts);
            matchedProducts = matched;
        }
        else {
            let {matched} = this.matchProducts(fromStocks, insalesProducts, options);
            matchedProducts = matched;
        }

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

    async fetchStocksForDb(key) {
        let insalesProducts = await this.fetchProducts();
        debug('Fetched %s products', insalesProducts.length);
        let options = await this.fetchOptions();
        debug('Fetched %s options', options.length);
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
        let anySizeOptionIds = options
            .filter(option => {
                let lcTitle = option.title.toLowerCase();
                return lcTitle.indexOf('размер') !== -1;
            })
            .map(option => option.id);

        let colorOptionIds = options
            .filter(option => option.title.toLowerCase().indexOf('цвет') !== -1)
            .map(option => option.id);

        let neededOptionIds = {
            color: colorOptionIds,
            sizeRu: ruSizeOptionIds,
            sizeDe: deSizeOptionIds,
            sizeAny: anySizeOptionIds
        }

        let insalesStocks = insalesProducts.reduce((stocks, product) => {
            if (product && product.variants) {
                let variants = product.variants.map(variant => this.makeDbProductFromVariant(variant, neededOptionIds, key, product));
                stocks = stocks.concat(variants);
            }
            return stocks;
        }, []);

        debug('Loaded %s variants', insalesStocks.length);
        return insalesStocks;
    }
}