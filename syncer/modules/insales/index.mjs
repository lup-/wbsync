import axios from "axios";
import clone from "lodash.clonedeep";

const API_BASE_URL = 'https://myshop-bmb974.myinsales.ru/';

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
}