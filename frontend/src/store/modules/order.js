import Crud from "./baseCrud";
import axios from "axios";

const API_LIST_URL = `/api/order/list`;
const API_ADD_URL = `/api/order/add`;
const API_UPDATE_URL = `/api/order/update`;
const API_DELETE_URL = `/api/order/delete`;

const NAME_ITEMS = 'orders';
const NAME_ITEM = 'order';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
},
{
    state: {
        filterFieldEnums: null,
    },
    actions: {
        async loadFilterEnums({commit}) {
            let response = await axios.get('/api/order/filters');
            return commit('setFilterFieldEnums', response.data);
        },
    },
    mutations: {
        setFilterFieldEnums(state, enums) {
            state.filterFieldEnums = enums;
        },
    }
});