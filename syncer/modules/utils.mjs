import moment from "moment";

function normalizeDate(someDate, defaultDate) {
    if (!someDate) {
        return  defaultDate;
    }
    else {
        if (moment.isMoment(someDate)) {
            return someDate;
        }

        try {
            let momentDate = moment(someDate);
            return momentDate && momentDate.isValid()
                ? momentDate
                : defaultDate;
        }
        catch (e) {
            return defaultDate;
        }
    }
}

function getUniqueCodeByProps(product) {
    let size = '*';
    let color = '*';

    if (product.size.ru) {
        size = product.size.ru;
    }

    if (product.size.de) {
        size = product.size.de;
    }

    if (product.color) {
        color = product.color;
    }

    return [product.sku, color, size].join('/');
}

function splitIntoChunks(array, chunkSize) {
    let chunks = [];
    let currentChunk = [];
    for (let item of array) {
        currentChunk.push(item);

        if (currentChunk.length >= chunkSize) {
            chunks.push(currentChunk);
            currentChunk = [];
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}

function matchByBarcode(sourceProduct, targetProducts) {
    let srcBarcode = sourceProduct.barcode;
    if (!srcBarcode) {
        return [];
    }

    return targetProducts.filter(targetProduct => targetProduct.barcode === srcBarcode);
}

function matchBySku(sourceProduct, targetProducts) {
    let srcSku = sourceProduct.sku;
    if (!srcSku) {
        return [];
    }

    return targetProducts.filter(targetProduct => targetProduct.sku === srcSku);
}

function matchByBarcodeOrSku(sourceProduct, targetProducts) {
    let matchedByBarcode = matchByBarcode(sourceProduct, targetProducts);
    if (matchedByBarcode && matchedByBarcode.length > 0) {
        return matchedByBarcode;
    }

    return matchBySku(sourceProduct, targetProducts);
}

export {normalizeDate, getUniqueCodeByProps, splitIntoChunks, matchByBarcode, matchBySku, matchByBarcodeOrSku}