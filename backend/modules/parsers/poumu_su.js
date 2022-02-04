const {parseUrl, innerText} = require('../Parser');

module.exports = function () {
    return {
        async getProduct(url, extra = false) {
            let product = await parseUrl(url, {
                name(document) {
                    let titleEl = document.querySelector('.in-blocks__title-name');
                    return innerText(titleEl);
                },
                description(document) {
                    let descriptionEl = document.querySelector('.product__summary');
                    return innerText(descriptionEl);
                },
                code() {
                    return null;
                },
                available(document) {
                    let availabilityEl = document.querySelector('.stocks__stock');
                    let availableText = innerText(availabilityEl);
                    return availableText.toLowerCase() === 'в наличии';
                },
                price(document) {
                    let priceEl = document.querySelector('.price.product__price');
                    let priceText = priceEl.getAttribute('data-price');
                    return parseFloat(priceText);
                }
            });

            return product;
        },
        async getVariants(url) {
            return false;
        }
    }
}