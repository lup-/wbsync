function intersect(array1, array2) {
    return array1.filter(value => array2.includes(value));
}

function ensureArray(value) {
    return value instanceof Array
        ? value
        : [value];
}

function getSystemFieldCodes(productType) {
    let systemFieldTypes = ['barcode', 'sku', 'price', 'quantity', 'title'];

    return productType.fields.reduce((systemFieldCodes, field) => {
        let isSystemField = systemFieldTypes.indexOf(field.type) !== -1;
        if (isSystemField) {
            if (!systemFieldCodes[field.type]) {
                systemFieldCodes[field.type] = [];
            }

            systemFieldCodes[field.type].push(field.code);
        }

        return systemFieldCodes;
    }, {});
}

function prepareProduct(supplyProduct, systemFieldCodes) {
    let systemFields = {};

    for (let fieldType of Object.keys(systemFieldCodes)) {
        let values = [];
        for (let fieldCode of systemFieldCodes[fieldType]) {
            let value = supplyProduct[fieldCode];
            if (value instanceof Array) {
                values = values.concat(value);
            }
            else {
                values.push(supplyProduct[fieldCode]);
            }
        }

        if (values.length <= 1) {
            values = typeof (values[0]) !== 'undefined'
                ? values[0]
                : null;
        }

        systemFields[fieldType] = values;
    }

    let product = systemFields;
    product.barcode = ensureArray(product.barcode);
    product.props = supplyProduct;
    return product;
}

function prepareProducts(supplyProducts, productType) {
    let systemFieldCodes = getSystemFieldCodes(productType);

    return supplyProducts.map(supplyProduct => {
        let product = prepareProduct(supplyProduct, systemFieldCodes);
        product.productTypeId = productType.id;
        return product;
    });
}

function getGroupBarcodes(groupProducts) {
    return groupProducts
        .reduce((barcodes, product) => {
            return barcodes.concat( ensureArray(product.barcode) );
        }, [])
        .filter((barcode, index, allBarcodes) => {
            return allBarcodes.indexOf(barcode) === index;
        });
}

function joinProductsByBarcodes(products) {
    let productGroupsByBarcode = products.reduce((groups, product) => {
        let currentBarcodes = ensureArray(product.barcode);

        let isBarcodeFoundInKeys = currentBarcodes.reduce((barcodeAlreadyFound, barcode) => {
            if (barcodeAlreadyFound) {
                return barcodeAlreadyFound;
            }

            let currentBarcodeFoundInGroupKeys = typeof (groups[barcode]) !== 'undefined';
            if (currentBarcodeFoundInGroupKeys) {
                return barcode;
            }

            return false;
        }, false);

        if (isBarcodeFoundInKeys) {
            groups[isBarcodeFoundInKeys].push(product);
            return groups;
        }
        else {
            for (let groupBarcode of Object.keys(groups)) {
                let groupProducts = groups[groupBarcode];
                let groupBarcodes = getGroupBarcodes(groupProducts);

                let intersectingBarcodes = intersect(groupBarcodes, currentBarcodes);
                let isBarcodeFoundInGroupProducts = intersectingBarcodes && intersectingBarcodes.length > 0;
                if (isBarcodeFoundInGroupProducts) {
                    groups[groupBarcode].push(product);
                    return groups;
                }
            }
        }

        let newGroupBarcode = currentBarcodes[0];
        groups[newGroupBarcode] = [product];
        return groups;
    }, {});

    let joinedProducts = [];
    for (let groupBarcode of Object.keys(productGroupsByBarcode)) {
        let groupProducts = productGroupsByBarcode[groupBarcode];
        let groupBarcodes = getGroupBarcodes(groupProducts);
        let totalQuantity = groupProducts.reduce((sum, product) => sum+product.quantity, 0);

        let joinedProduct = Object.assign({}, groupProducts[0]);
        joinedProduct.barcode = groupBarcodes;
        joinedProduct.quantity = totalQuantity;
        joinedProducts.push(joinedProduct);
    }

    return joinedProducts;
}

async function syncProducts(db, products, supply, productType, options) {
    let {stockType, updateProps, joinSameBarcodes} = options;

    if (joinSameBarcodes) {
        products = joinProductsByBarcodes(products);
    }

    let allBarcodes = products.reduce((barcodes, product) => {
        if (product.barcode instanceof Array) {
            barcodes = barcodes.concat(product.barcode);
        }
        else {
            if (product.barcode) {
                barcodes.push(product.barcode);
            }
        }

        return barcodes;
    }, []);

    let existingProductsFromDb = await db.collection('products').find({barcode: {$in: allBarcodes}}).toArray();

    let productsToUpdate = [];
    let productsToInsert = [];

    for (let product of products) {
        let importingBarcodes = ensureArray(product.barcode);

        let productIndex = existingProductsFromDb.findIndex(dbProduct => {
            let dbBarcodes = ensureArray(dbProduct.barcode);

            let intersectingBarcodes = intersect(dbBarcodes, importingBarcodes);
            let hasSameBarcodes = intersectingBarcodes.length > 0;

            return hasSameBarcodes;
        });

        if (productIndex === -1) {
            productsToInsert.push(product);
        }
        else {
            productsToUpdate.push({
                db: existingProductsFromDb[productIndex],
                import: product
            });
        }
    }

    let bulkUpdates = productsToUpdate.map(productToUpdate => {
        let operations = {};

        if (updateProps) {
            let newProduct = Object.assign({}, productToUpdate.import);
            operations['$set'] = newProduct;
            if (stockType === 'add') {
                operations['$set']['quantity'] = productToUpdate.db.quantity + productToUpdate.import.quantity;
            }

        }
        else {
            if (stockType === 'add') {
                operations['$inc'] = {quantity: productToUpdate.import.quantity}
            }
            else {
                if (typeof (operations['$set']) === 'undefined') {
                    operations['$set'] = {quantity: products.import.quantity};
                }
                else {
                    operations['$set']['quantity'] =  products.import.quantity;
                }
            }
        }


        return {
            updateOne: {
                filter: {_id: productToUpdate.db._id},
                update: operations,
            }
        }
    });

    if (productsToInsert && productsToInsert.length > 0) {
        await db.collection('products').insertMany(productsToInsert);
    }

    if (bulkUpdates && bulkUpdates.length > 0) {
        await db.collection('products').bulkWrite(bulkUpdates);
    }

    return {
        newProducts: productsToInsert.length,
        updatedProducts: productsToUpdate.length,
    }
}

module.exports = {prepareProducts, syncProducts}