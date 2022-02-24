const {parseUrl, innerText} = require('../Parser');

function getOfferRow(document, extra) {
    let [rowIndex, cellIndex] = extra.split('/');
    rowIndex = parseInt(rowIndex);
    cellIndex = parseInt(cellIndex);

    let table = document.querySelector('table[bordercolorlight="#C0C0C0"]');
    let tableRow = table.querySelector('tr:nth-child('+(rowIndex+1)+')');
    let cells = tableRow.querySelectorAll('td');

    let name = innerText(cells[0]);
    let priceText = innerText(cells[cellIndex])
        .replace(/[^0-9]+/g, ' ')
        .trim();
    let price = parseFloat(priceText);
    return {name, price};
}

module.exports = function () {
    return {
        async getProduct(url, extra = false) {
            let product = await parseUrl(url, {
                name(document) {
                    let {name, price} = getOfferRow(document, extra);
                    return name;
                },
                description() {
                    return null;
                },
                code() {
                    return null;
                },
                available() {
                    return null;
                },
                price(document) {
                    let {name, price} = getOfferRow(document, extra);
                    return price;
                }
            });

            return product;
        },
        async getVariants(url) {
            let {variants} = await parseUrl(url, {
                variants(document) {
                    let table = document.querySelector('table[bordercolorlight="#C0C0C0"]');
                    let tableRows = table.querySelectorAll('tr');
                    let variants = [];
                    let rowIndex = 0;
                    for (let rowEl of tableRows) {
                        let cells = rowEl.querySelectorAll('td');
                        let name = innerText(cells[0]);

                        if (rowIndex > 0) {
                            variants.push({
                                name: name + ', 2м',
                                value: rowIndex + '/1',
                            });

                            variants.push({
                                name: name + ', кроме 2м',
                                value: rowIndex + '/2',
                            });
                        }

                        rowIndex++;
                    }

                    return variants;
                }
            });

            return variants || false;
        }
    }
}