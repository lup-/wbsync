function getHost(link) {
    if (link.indexOf('http') !== 0) {
        link = 'https://'+link;
    }

    try {
        let url = new URL(link);
        if (url && url.hostname) {
            return url.hostname.toLowerCase()
                .replace('www.', '');
        }
        return false;
    }
    catch (e) {
        return  false;
    }
}
function getParser(url) {
    let host = getHost(url);
    let filename = host.replace('.', '_') + '.js';
    try {
        let Parser = require('./'+filename);
        return new Parser();
    }
    catch (e) {
        return null;
    }
}

async function parseWatchItem(watchItem) {
    let parsedProducts = [];
    for (let linkData of watchItem.links) {
        let url = linkData;
        let extra = false;
        if (typeof (linkData) === 'object') {
            url = linkData.link;
            extra = linkData.extra;
        }

        let host = getHost(url);
        let parser = getParser(url);
        if (parser) {
            let product;

            try {
                product = await parser.getProduct(url, extra);
            }
            catch (e) {
                product = null;
            }

            if (product) {
                product.host = host;
                product.linkName = linkData.name;
                parsedProducts.push(product);
            }
        }
    }

    return parsedProducts;
}

module.exports = {getParser, parseWatchItem}