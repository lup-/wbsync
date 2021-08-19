import Crud from "./baseCrud";

const API_LIST_URL = `/api/stock/list`;
const API_ADD_URL = `/api/stock/add`;
const API_UPDATE_URL = `/api/stock/update`;
const API_DELETE_URL = `/api/stock/delete`;

const NAME_ITEMS = 'stock';
const NAME_ITEM = 'stock';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
});