const {parseUrl, innerText} = require('../Parser');

module.exports = function () {
    return {
        async getProduct(url) {
            let product = await parseUrl(url, {
                name(document) {
                    let titleEl = document.querySelector('.product-page h1');
                    return innerText(titleEl);
                },
                description(document) {
                    let descriptionEl = document.querySelector('.product-page #tab-description');
                    return innerText(descriptionEl);
                },
                code(document) {
                    let dataLists = document.querySelectorAll('.product-page .col-sm-5 .list-unstyled');
                    let codeAvailList = dataLists[0];
                    let dataRows = codeAvailList.querySelectorAll('li');
                    let codeEl = dataRows[0];
                    let code = innerText(codeEl).replace(/^.*?: */, '').trim();
                    return code;
                },
                available(document) {
                    let dataLists = document.querySelectorAll('.product-page .col-sm-5 .list-unstyled');
                    let codeAvailList = dataLists[0];
                    let dataRows = codeAvailList.querySelectorAll('li');
                    let availabilityEl = dataRows[1];
                    let availableText = innerText(availabilityEl).replace(/^.*?: */, '').trim();
                    return availableText.toLowerCase() === 'в наличии';
                },
                price(document) {
                    let priceEl = document.querySelector('.product-page .autocalc-product-price');
                    let priceText = innerText(priceEl)
                        .replace(/[^0-9\.,]+/, '')
                        .replace(/\.*$/, '')
                        .trim();
                    return parseFloat(priceText);
                }
            });

            return product;
        }
    }
}