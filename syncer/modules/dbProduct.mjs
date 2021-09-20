import clone from "lodash.clonedeep";

function setNotNullFields(object, fields) {
    let newObject = clone(object);

    for (let key of Object.keys(fields)) {
        let value = fields[key];

        if (value !== null) {
            if (typeof (value) === 'object') {
                if (value instanceof Array) {
                    newObject[key] = clone(value);
                }
                else {
                    newObject[key] = setNotNullFields(newObject[key] || {}, value);
                }
            }
            else {
                newObject[key] = value;
            }
        }
    }

    return newObject;
}

export class Product {
    constructor(fields = {}) {
        this.fields = {
            source: null,
            sourceType: null,
            keyId: null,

            id: null,
            sku: null,
            color: null,
            size: {
                ru: null,
                de: null
            },
            variant: null,
            title: null,
            brand: null,
            barcode: null,
            quantity: null,
            price: null,
            raw: {},
        }

        this.setFields(fields);
    }

    setFields(newFields) {
        this.fields = setNotNullFields(this.fields, newFields);
    }

    setRaw(type, raw) {
        if (!this.fields.raw) {
            this.fields.raw = {};
        }

        this.fields.raw[type] = raw;
    }

    getJson() {
        return this.fields;
    }
}