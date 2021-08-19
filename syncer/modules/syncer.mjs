import clone from "lodash.clonedeep";

const WB_PRODUCTS_COLLECTION = 19231537;
const WB_PRODUCTS_CATEGORY = 22486737;

const INSALES_SIZE_PROPERTY_NAME = 'Размер RU';
const INSALES_COLOR_PROPERTY_NAME = 'Цвет';

export class Syncer {
    constructor(db = null, insales = null, wb = null) {
        this.db = db;
        this.insales = insales;
        this.wb = wb;

        this.insalesProducts = [];
        this.insalesOptions = [];

        this.sizeOptionId = false;
        this.colorOptionId = false;
    }

    findProductByVariantField(fieldName, fieldValue, insalesProducts, fullMatch = true) {
        for (let insalesProduct of insalesProducts) {
            let matchingVariants = insalesProduct.variants.filter(variant => {
                return fullMatch
                    ? variant[fieldName] === fieldValue
                    : variant[fieldName].indexOf(fieldValue) === 0;
            });

            let hasVariantWithMatchingSku = matchingVariants && matchingVariants.length > 0;
            if (hasVariantWithMatchingSku) {
                let matchingProduct = clone(insalesProduct);
                delete matchingProduct.variants;
                matchingProduct.variant = matchingVariants[0];

                return matchingProduct;
            }
        }
        return null;
    }

    findInsalesProductForWb(wbProduct, insalesProducts) {
        let wbSku = wbProduct.supplierArticle;
        let matchingProduct = this.findProductByVariantField('sku', wbSku, insalesProducts);

        if (matchingProduct) {
            return matchingProduct;
        }

        let wbBarcode = wbProduct.barcode;
        matchingProduct = this.findProductByVariantField('barcode', wbBarcode, insalesProducts);

        if (matchingProduct) {
            return matchingProduct;
        }

        if (wbSku.indexOf('/') !== -1) {
            let [productArticle, ] = wbSku.split('/');
            matchingProduct = this.findProductByVariantField('sku', wbSku, insalesProducts, false);
        }

        return matchingProduct;
    }

    async fetchProducts() {
        this.insalesProducts = await this.insales.fetchProducts();
        return this.insalesProducts;
    }

    async fetchOptions() {
        this.insalesOptions = await this.insales.fetchOptions();
    }

    async prepareInsalesData() {
        await this.fetchProducts();
        await this.fetchOptions();

        let sizeOption = this.insalesOptions.find(option => option.title === INSALES_SIZE_PROPERTY_NAME);
        let colorOption = this.insalesOptions.find(option => option.title === INSALES_COLOR_PROPERTY_NAME);

        if (sizeOption) {
            this.sizeOptionId = sizeOption.id;
        }

        if (colorOption) {
            this.colorOptionId = colorOption.id;
        }
    }

    makeInsalesVariantFromWb(wbProduct) {
        return {
            "sku": wbProduct.supplierArticle,
            "barcode": wbProduct.barcode,
            "title": wbProduct.techSize,
            "quantity": 1,
            "price": wbProduct.price
        }
    }

    async addWbProductToInsales(wbProduct) {
        let title = [wbProduct.subject];
        if (wbProduct.brand) {
            title.push(wbProduct.brand);
        }
        title = title.join(' ');

        let insalesProduct = {
            "category_id": WB_PRODUCTS_CATEGORY,
            "title": title,
            "variants_attributes": [],
            "ignore_discounts": false,
            "vat": -1,
            "is_hidden": true
        };

        let insalesVariant = this.makeInsalesVariantFromWb(wbProduct);

        return this.insales.addProductWithVariant(insalesProduct, insalesVariant, WB_PRODUCTS_COLLECTION);
    }

    async syncWbProducts(wbProducts = []) {
        let syncedProducts = [];
        for (let wbProduct of wbProducts) {
            let insalesProduct = this.findInsalesProductForWb(wbProduct, this.insalesProducts);
            if (!insalesProduct) {
                insalesProduct = await this.addWbProductToInsales(wbProduct);
                this.insalesProducts.push(insalesProduct);
            }

            if (insalesProduct && insalesProduct.variant && insalesProduct.variant.sku !== wbProduct.supplierArticle) {
                let insalesVariant = this.makeInsalesVariantFromWb(wbProduct);
                let addedVariant = this.insales.addVariantToProduct(insalesProduct, insalesVariant);

                if (!insalesProduct.variants) {
                    insalesProduct.variants = [];
                }

                insalesProduct.variants.push(addedVariant);
                let productIndex = this.insalesProducts.findIndex(product => product.id === insalesProduct.id);
                if (productIndex !== -1) {
                    this.insalesProducts[productIndex] = insalesProduct;
                }
            }
        }
    }

    getInsalesProductsFromOrder(order) {
        let wbProducts = this.wb.getProductFromOrder(order);
        if ( wbProducts && !(wbProducts instanceof Array) ) {
            wbProducts = [wbProducts];
        }

        return wbProducts.map( wbProduct => this.findInsalesProductForWb(wbProduct, this.insalesProducts) );
    }

    async filterProcessedOrders(activeOrders) {
        let wbIds = activeOrders.map(order => order.incomeID);
        let savedOrders = this.db.collection('orders').find({wbId: {$in: wbIds}}).toArray();
        let processedIds = savedOrders.map(savedOrder => savedOrder.wbId);

        let newWbIds = wbIds.filter(activeWbId => !processedIds.includes(activeWbId));
        let newOrders = activeOrders.filter(activeOrder => newWbIds.includes(activeOrder.incomeID));

        return newOrders;
    }

    async addNewWbOrders(newWbOrders) {
        /* Нужно доделывать */
        for (let newWbOrder of newWbOrders) {
            let products = this.getInsalesProductsFromOrder(newWbOrder);

            let orderLineAttributes = products.map(product => {
                return {
                    'product_id': product.id,
                    'variant_id': product.variant.id,
                    'quantity': newWbOrder.quantity,
                }
            });

            let newInsalesOrder = {
                'source': 'WB FBS Syncer',
                "delivery_title": 'WB FBS',
                "delivery_description": 'WB FBS',
                "client_attributes": {
                    "id": 2,
                    "name": "Ivan",
                    "email": "ivan@example.com",
                    "phone": "79111113344",
                    "fields_values_attributes": [
                        {
                            "field_id": 252,
                            "value": "new!"
                        }
                    ]
                },
            }
        }
    }


}