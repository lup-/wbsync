import Crud from "./baseCrud";

const API_LIST_URL = `/api/productType/list`;
const API_ADD_URL = `/api/productType/add`;
const API_UPDATE_URL = `/api/productType/update`;
const API_DELETE_URL = `/api/productType/delete`;

const NAME_ITEMS = 'productTypes';
const NAME_ITEM = 'productType';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
}, {
    getters: {
        byId(state) {
            return itemId => {
                return state.list.find(item => item.id === itemId);
            }
        }
    }
});