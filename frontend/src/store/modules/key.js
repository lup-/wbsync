import Crud from "./baseCrud";

const API_LIST_URL = `/api/key/list`;
const API_ADD_URL = `/api/key/add`;
const API_UPDATE_URL = `/api/key/update`;
const API_DELETE_URL = `/api/key/delete`;

const NAME_ITEMS = 'keys';
const NAME_ITEM = 'key';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
});