import Crud from "./baseCrud";
import axios from "axios";

const API_LIST_URL = `/api/supply/list`;
const API_ADD_URL = `/api/supply/add`;
const API_UPDATE_URL = `/api/supply/update`;
const API_DELETE_URL = `/api/supply/delete`;

const NAME_ITEMS = 'supplies';
const NAME_ITEM = 'supply';

function convertItemToForm(item) {
    let formData = new FormData();
    for (let key in item) {
        let value = item[key];
        if (value instanceof File) {
            formData.append(key, value, value.name);
        }
        else {
            formData.append(key, value);
        }
    }

    return formData;
}

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
}, {
    state: {
        supplyProductsTotalCount: 0,
        supplyProducts: [],
        selectedProductType: null,
    },
    actions: {
        async newItem({dispatch, state}, item) {
            if (!API_ADD_URL) {
                return;
            }

            let formData = convertItemToForm(item);
            let result = await axios.post(API_ADD_URL, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            dispatch('setEditItem', result.data[NAME_ITEM]);
            return dispatch('loadItems', state.currentParams);
        },
        async loadProducts({commit}, inputParams) {
            let {filter = {}, limit = 15, offset = 0, sort = {}, supply} = {...inputParams};

            let response = await axios.post('/api/supply/listProducts', {filter, limit, offset, sort, supply});
            await commit('setSupplyProductsTotalCount', response.data['totalCount']);
            await commit('setSelectedProductType', response.data['productType']);
            return commit('setSupplyProducts', response.data['supplyProducts']);
        },
        async saveItem({dispatch, commit, state}, item) {
            if (!API_UPDATE_URL) {
                return;
            }

            try {
                let formData = convertItemToForm(item);
                let response = await axios.post(API_UPDATE_URL, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                let isSuccess = response && response.data && response.data[NAME_ITEM] && response.data[NAME_ITEM].id;
                if (isSuccess) {
                    commit('setSuccessMessage', 'Данные сохранены!', { root: true });
                }
                else {
                    commit('setErrorMessage', 'Ошибка сохранения данных!', { root: true });
                }
            }
            catch (e) {
                commit('setErrorMessage', 'Ошибка сохранения данных!', { root: true });
            }

            return dispatch('loadItems', state.currentParams);
        },
        async accept(_, {supply, options}) {
            let query = {supply, options};
            await axios.post('/api/supply/accept', query);
        },
    },
    mutations: {
        setSupplyProducts(state, items) {
            state.supplyProducts = items;
        },
        setSupplyProductsTotalCount(state, totalCount) {
            state.supplyProductsTotalCount = totalCount;
        },
        setSelectedProductType(state, productType) {
            state.selectedProductType = productType;
        },
    }
});