const {parseUrl, innerText} = require('../Parser');

module.exports = function () {
    return {
        async getProduct(url, extra = false) {
            let product = await parseUrl(url, {
                name(document) {
                    let titleEl = document.querySelector('.js-product-selection__title');
                    return innerText(titleEl);
                },
                description(document) {
                    let descriptionEl = document.querySelector('.js-product-selection__description');
                    return innerText(descriptionEl);
                },
                code() {
                    return null;
                },
                available() {
                    return null;
                },
                price(document) {
                    let priceEl = document.querySelector('.js-product-section__current-price');
                    if (priceEl) {
                        let priceText = innerText(priceEl);
                        return parseFloat(priceText);
                    }

                    return null;
                }
            }, false, false, false, true);

            return product;
        },
        async getVariants(url) {
            return false;
        }
    }
}