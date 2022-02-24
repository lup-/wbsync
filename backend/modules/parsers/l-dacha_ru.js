const {parseUrl, innerText} = require('../Parser');

module.exports = function () {
    return {
        async getProduct(url, extra = false) {
            let product = await parseUrl(url, {
                name(document) {
                    let titleEl = document.querySelector('h1#pagetitle');
                    return innerText(titleEl);
                },
                description(document) {
                    let descriptionEl = document.querySelector('.properties.list');
                    return innerText(descriptionEl);
                },
                code(document) {
                    let codeEl = document.querySelector('.article__value');
                    return codeEl ? innerText(codeEl) : false;
                },
                available(document) {
                    let availabilityEl = document.querySelector('link[itemprop="availability"]');
                    if (availabilityEl) {
                        let availableText = availabilityEl.getAttribute('href');
                        return availableText.toLowerCase().indexOf('/instock') !== -1;
                    }

                    return null;
                },
                price(document) {
                    let priceEl = document.querySelector('meta[itemprop="price"]');
                    if (priceEl) {
                        let priceText = priceEl.getAttribute('content');
                        return parseFloat(priceText);
                    }

                    return null;
                }
            });

            return product;
        },
        async getVariants(url) {
            return false;
        }
    }
}