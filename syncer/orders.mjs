import createDebug from "debug";
import {syncAllOrders} from "./modules/orders.mjs";

const debug = createDebug('syncer:orders');


(async () => {
    await syncAllOrders(debug);
    process.exit();
})();