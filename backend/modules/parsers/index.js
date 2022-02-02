function getHost(link) {
    if (link.indexOf('http') !== 0) {
        link = 'https://'+link;
    }

    try {
        let url = new URL(link);
        return url.hostname.toLowerCase() || false;
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
    for (let url of watchItem.links) {
        let host = getHost(url);
        let parser = getParser(url);
        if (parser) {
            let product = await parser.getProduct(url);

            if (product) {
                product.host = host;
                parsedProducts.push(product);
            }
        }
    }

    return parsedProducts;
}

module.exports = {getParser, parseWatchItem}