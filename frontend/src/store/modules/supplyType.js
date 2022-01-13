import Crud from "./baseCrud";

const API_LIST_URL = `/api/supplyType/list`;
const API_ADD_URL = `/api/supplyType/add`;
const API_UPDATE_URL = `/api/supplyType/update`;
const API_DELETE_URL = `/api/supplyType/delete`;

const NAME_ITEMS = 'supplyTypes';
const NAME_ITEM = 'supplyType';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
});