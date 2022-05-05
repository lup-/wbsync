import Crud from "./baseCrud";
import axios from "axios";
import {downloadFile} from "@/store/modules/download";
import moment from "moment";

const API_LIST_URL = `/api/exportType/list`;
const API_ADD_URL = `/api/exportType/add`;
const API_UPDATE_URL = `/api/exportType/update`;
const API_DELETE_URL = `/api/exportType/delete`;
const API_EXPORT_URL = `/api/export`

const NAME_ITEMS = 'exportTypes';
const NAME_ITEM = 'exportType';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
}, {
    actions: {
        async exportProducts(_, options) {
            try {
                let response = await axios({
                    url: API_EXPORT_URL,
                    method: 'POST',
                    data: {options},
                    responseType: 'blob'
                });

                downloadFile(response.data, `export_${moment().unix()}.csv`);
            }
            catch (e) {
                if (e.constructor.name !== 'Cancel') {
                    throw e;
                }
            }
        }
    }
});