import Crud from "./baseCrud";

const API_LIST_URL = `/api/product/list`;
const API_ADD_URL = `/api/product/add`;
const API_UPDATE_URL = `/api/product/update`;
const API_DELETE_URL = `/api/product/delete`;

const NAME_ITEMS = 'products';
const NAME_ITEM = 'product';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
});