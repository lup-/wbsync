import createDebug from "debug";
import {downloadAllStocks} from "./modules/stocks.mjs";

const debug = createDebug('syncer:stocks');
const jsonPath = process.env['JSON_PATH'];

(async () => {
    await downloadAllStocks(debug, jsonPath);

    debug('Done!');
    process.exit();
})();
