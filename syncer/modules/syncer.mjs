import clone from "lodash.clonedeep";

const WB_PRODUCTS_COLLECTION = 19231537;
const WB_PRODUCTS_CATEGORY = 22486737;

const INSALES_SIZE_PROPERTY_NAME = 'Размер RU';
const INSALES_COLOR_PROPERTY_NAME = 'Цвет';

export class Syncer {
    constructor(db = null, provider = null) {
        this.db = db;
        this.provider = provider;
    }

    updateStocksFromProvider() {

    }
}