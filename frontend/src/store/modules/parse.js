import Crud from "./baseCrud";

const API_LIST_URL = `/api/parse/list`;
const API_ADD_URL = `/api/parse/add`;
const API_UPDATE_URL = `/api/parse/update`;
const API_DELETE_URL = `/api/parse/delete`;

const NAME_ITEMS = 'parseLinks';
const NAME_ITEM = 'parseLink';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
});