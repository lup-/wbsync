import Vue from 'vue';
import Vuex from 'vuex';

import stock from "./modules/stock";
import key from "./modules/key";
import user from "./modules/user";
import order from "./modules/order";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        appError: false,
        appMessage: false,
        loading: false,
        routes: [
            {code: 'stockList', title: 'Остатки', icon: 'mdi-tshirt-v'},
            {code: 'orderList', title: 'Заказы', icon: 'mdi-cart'},
            {code: 'keyList', title: 'Ключи доступа', icon: 'mdi-key'},
            {code: 'usersList', title: 'Пользователи', icon: 'mdi-account'},
        ]
    },
    getters: {
        allowedRoutes(state, getters) {
            return state.routes.filter(route => getters.userHasRights(route.code));
        }
    },
    mutations: {
        setLoading(state, newLoadingState) {
            state.loading = newLoadingState;
        },
        setAppError(state, error) {
            state.appError = error;
        },
        setErrorMessage(state, text) {
            state.appMessage = {text, color: 'error'};
        },
        setSuccessMessage(state, text) {
            state.appMessage = {text, color: 'success'};
        },
        setInfoMessage(state, text) {
            state.appMessage = {text, color: 'info'};
        },
    },
    actions: {},
    modules: {
        stock,
        user,
        key,
        order
    }
})
