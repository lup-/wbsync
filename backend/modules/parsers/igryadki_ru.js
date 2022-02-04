const {parseUrl, innerText} = require('../Parser');

function getProductFromJson(document) {
    let scriptEl = document.querySelector('script[type="application/ld+json"]');
    let json = innerText(scriptEl);
    try {
        let product = JSON.parse(json);
        return product;
    }
    catch (e) {
        return false;
    }
}

function getOfferFromJson(document, offerId) {
    let product = getProductFromJson(document);
    if (product && product.offers && product.offers.offers) {
        return product.offers.offers.find(offer => offer.sku === offerId);
    }
    return false;
}

module.exports = function () {
    return {
        async getProduct(url, extra = false) {
            let product = await parseUrl(url, {
                name(document) {
                    let product = getProductFromJson(document);
                    return product ? product.name : null;
                },
                description(document) {
                    let product = getProductFromJson(document);
                    return product ? product.description : null;
                },
                code(document) {
                    let product = getProductFromJson(document);
                    return product ? product.sku : null;
                },
                available(document) {
                    let offer = getOfferFromJson(document, extra);
                    return offer ? offer.availability === 'https://schema.org/InStock' : null;
                },
                price(document) {
                    let offer = getOfferFromJson(document, extra);
                    let priceText = offer ? offer.price : null;
                    return priceText ? parseFloat(priceText) : null;
                }
            });

            return product;
        },
        async getVariants(url) {
            let {variants} = await parseUrl(url, {
                variants(document) {
                    let nameOptions = document.querySelectorAll('select[name="variant_id"] option');
                    let variantNames = {};
                    for (let option of nameOptions) {
                        let sku = option.getAttribute('value');
                        variantNames[sku] = innerText(option);
                    }

                    let product = getProductFromJson(document);
                    let variants = [];
                    if (product && product.offers && product.offers.offers) {
                        variants = product.offers.offers.map(offer => {
                            let sku = offer.sku;
                            return {
                                name: variantNames[sku] || '-',
                                value: sku
                            }
                        })
                    }

                    return variants;
                }
            });

            return variants;
        }
    }
}