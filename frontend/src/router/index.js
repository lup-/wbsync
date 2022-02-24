import Vue from 'vue';
import VueRouter from 'vue-router';

import Home from "../components/Home";
import Login from '../components/Users/Login';
import StockList from "../components/Stock/StockList";
import OrderList from "../components/Order/OrderList";
import CompareList from "@/components/Compare/CompareList";
import ProductCompareList from "@/components/Compare/ProductCompareList";
import KeyList from "../components/Key/KeyList";
import UsersList from "../components/Users/List";
import UserEdit from "../components/Users/Edit";
import ProductTypeList from "@/components/ProductType/ProductTypeList";
import SupplyTypeList from "@/components/SupplyType/SupplyTypeList";
import SupplyList from "@/components/Supply/SupplyList";
import ParseList from "@/components/ParseProducts/ParseList";

import CompareHeader from "@/components/Compare/CompareHeader";
import OrderHeader from "@/components/Order/OrderHeader";
import ParseHeader from "@/components/ParseProducts/ParseHeader";

import store from "../store";

Vue.use(VueRouter);

const routes = [
    { name: 'home', path: '/', components: {content: Home}, meta: {requiresAuth: true, group: 'home'} },
    { name: 'login', path: '/login', components: {content: Login} },
    { name: 'stockList', path: '/stock/', components: {content: StockList, header: CompareHeader}, meta: {requiresAuth: true, group: 'stockList'} },
    { name: 'compareList', path: '/compare/', components: {content: ProductCompareList, header: CompareHeader}, meta: {requiresAuth: true, group: 'compareList'} },
    { name: 'oldCompareList', path: '/compare/old', components: {content: CompareList, header: CompareHeader}, meta: {requiresAuth: true, group: 'oldCompareList'} },
    { name: 'orderList', path: '/order/', components: {content: OrderList, header: OrderHeader}, meta: {requiresAuth: true, group: 'orderList'} },
    { name: 'keyList', path: '/key/', components: {content: KeyList}, meta: {requiresAuth: true, group: 'keyList'} },
    { name: 'productTypeList', path: '/productType/', components: {content: ProductTypeList}, meta: {requiresAuth: true, group: 'productTypeList'} },
    { name: 'supplyTypeList', path: '/supplyType/', components: {content: SupplyTypeList}, meta: {requiresAuth: true, group: 'supplyTypeList'} },
    { name: 'supplyList', path: '/supply/', components: {content: SupplyList}, meta: {requiresAuth: true, group: 'supplyList'} },
    { name: 'usersList', path: '/users/', components: {content: UsersList}, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userNew', path: '/user/new', components: {content: UserEdit}, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userEdit', path: '/user/:id', components: {content: UserEdit}, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'parse', path: '/parse/', components: {content: ParseList, header: ParseHeader}, meta: {requiresAuth: true, group: 'parse'} },
]

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes
});

router.beforeEach(async (to, from, next) => {
    if (to.matched.some(record => record.meta.requiresAuth)) {
        await store.dispatch('loginLocalUser');
        let isNotLoggedIn = !store.getters.isLoggedIn;
        let loginTo = {
            path: '/login',
            query: { redirect: to.fullPath }
        };

        if (isNotLoggedIn) {
            next(loginTo);
        }
        else {
            let routeGroup = to.matched && to.matched[0] ? to.matched[0].meta.group : false;

            if (routeGroup && store.getters.userHasRights(routeGroup)) {
                next();
            }
            else {
                store.commit('setErrorMessage', 'Не достаточно прав!');
                next(loginTo);
            }
        }
    }
    else {
        next();
    }
})

export {router, store};