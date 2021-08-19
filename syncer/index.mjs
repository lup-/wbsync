import moment from "moment";
import {Wildberries} from "./modules/wildberries/index.mjs";
import {InSales} from "./modules/insales/index.mjs";
import {Syncer} from "./modules/syncer.mjs";
import {getDb} from "./modules/database.mjs";

const WB_API_V1_KEY_IP = process.env['WB_STAT_64_API_KEY_IP'];
const WB_API_V1_KEY_OOO = process.env['WB_STAT_64_API_KEY_OOO'];
const WB_API_V2_KEY_IP = process.env['WB_NEW_API_KEY_IP'];
const WB_API_V2_KEY_OOO = process.env['WB_NEW_API_KEY_OOO'];

const INSALES_API_ID=process.env['INSALES_API_ID'];
const INSALES_API_PASSWORD=process.env['INSALES_API_PASSWORD'];

async function processCycle(wbv1Key, wbv2Key) {
    let db = await getDb();
    let insales = new InSales(INSALES_API_ID, INSALES_API_PASSWORD);
    let wb = new Wildberries(wbv1Key, wbv2Key);

    let syncer = new Syncer(db, insales, wb);
    let today = moment().startOf('d');
    let someOtherDay = today.clone().subtract('15', 'd');

    let activeFbsOrders = await wb.getAllFBSOrders(someOtherDay);
    let wbProducts = activeFbsOrders.map(wb.getProductFromOrder);

    await syncer.prepareInsalesData();
    await syncer.syncWbProducts(wbProducts);

    let newWbFbsOrders = await syncer.filterProcessedOrders(activeFbsOrders);
    if (newWbFbsOrders.length > 0) {
        await syncer.addNewWbOrders(newWbFbsOrders);
    }
}


(async () => {
    await processCycle(WB_API_V1_KEY_OOO, WB_API_V2_KEY_OOO);
})();
