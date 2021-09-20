function getOrderFilter(inputFilter) {
    let defaultFilter = {
        'deleted': {$in: [null, false]}
    };

    let dateFlagFilters = ['created', 'updated', 'canceled', 'completed'];

    let filter = Object.assign(defaultFilter, {});
    for (let field in inputFilter) {
        let value = inputFilter[field];
        if (value instanceof Array) {
            filter[field] = {$in: value}
        }
        else if (dateFlagFilters.indexOf(field) !== -1) {
            if (typeof(value) === 'boolean') {
                filter[field] = value
                    ? {$gt: 0}
                    : {$in: [null, false, 0]};
            }
            else {
                filter[field] = value;
            }
        }
        else if (field === "id") {
            let intValue = null;
            try {
                intValue = parseInt(value);
            }
            finally {
                filter[field] = intValue !== null
                    ? {$in: [value, intValue]}
                    : value;
            }
        }
        else if (field === "barcode") {
            let intValue = null;
            try {
                intValue = parseInt(value);
            }
            finally {
                let matchQuery = intValue !== null
                    ? {$in: [value, intValue]}
                    : value;

                filter['products'] = {$elemMatch: {barcode: matchQuery}};
            }
        }
        else {
            filter[field] = value;
        }
    }

    return filter;
}

module.exports = {getOrderFilter};