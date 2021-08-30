import Crud from "./baseCrud";
import axios from "axios";

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
},
{
    state: {
        compare: null,
        compareVariants: null,
        compareParams: null,
        compareCount: 0,
    },
    actions: {
        async loadCompareItems({commit}, inputParams) {
            let {filter = {}, limit = 15, offset = 0, sort = {}, params = {}} = {...inputParams};

            if (!API_LIST_URL) {
                return;
            }

            let response = await axios.post('/api/stock/match', {filter, limit, offset, sort, ...params});
            await commit('setCompareParams', {filter, limit, offset, sort});
            await commit('setCompareTotalCount', response.data['totalCount']);
            await commit('setCompareVariants', response.data['variants']);
            return commit('setCompareItems', response.data[NAME_ITEMS]);
        },
    },
    mutations: {
        setCompareItems(state, items) {
            state.compare = items;
        },
        setCompareParams(state, params) {
            state.compareParams = params;
        },
        setCompareVariants(state, variants) {
            state.compareVariants = variants;
        },
        setCompareTotalCount(state, totalCount) {
            state.compareCount = totalCount;
        }
    }
});