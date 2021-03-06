import Vue from 'vue';
import Vuex from 'vuex';

import stock from "./modules/stock";
import key from "./modules/key";
import user from "./modules/user";
import order from "./modules/order";
import job from "@/store/modules/job";
import productType from "@/store/modules/productType";
import supplyType from "@/store/modules/supplyType";
import exportType from "@/store/modules/exportType";
import supply from "@/store/modules/supply";
import product from "@/store/modules/product";
import parse from "@/store/modules/parse";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        appError: false,
        appMessage: false,
        loading: false,
        routes: [
            {code: 'home', title: 'Панель управления', icon: 'mdi-home'},
            {code: 'productTypeList', title: 'Типы карточек товаров', icon: 'mdi-package-variant-closed'},
            {code: 'supplyTypeList', title: 'Шаблоны загрузок', icon: 'mdi-swap-vertical'},
            {code: 'exportTypeList', title: 'Шаблоны экспорта', icon: 'mdi-database-export'},
            {code: 'supplyList', title: 'Поставки', icon: 'mdi-truck'},
            {code: 'stockList', title: 'Остатки', icon: 'mdi-tshirt-v'},
            {code: 'productList', title: 'Товары в базе', icon: 'mdi-tshirt-v-outline'},
            {code: 'compareList', title: 'Сравнение остатков', icon: 'mdi-compare'},
            {code: 'oldCompareList', title: 'Старое сравнение остатков', icon: 'mdi-compare-remove'},
            {code: 'orderList', title: 'Заказы', icon: 'mdi-cart'},
            {code: 'keyList', title: 'Ключи доступа', icon: 'mdi-key'},
            {code: 'usersList', title: 'Пользователи', icon: 'mdi-account'},
            {code: 'parse', title: 'Мониторинг цен', icon: 'mdi-eye'},
        ],
        tableHeight: 530,
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
        order,
        job,
        productType,
        supplyType,
        exportType,
        supply,
        product,
        parse
    }
})
