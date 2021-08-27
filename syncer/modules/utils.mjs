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

export {normalizeDate, getUniqueCodeByProps}