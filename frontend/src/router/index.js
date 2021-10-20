import Vue from 'vue';
import VueRouter from 'vue-router';

import Home from "../components/Home";
import Login from '../components/Users/Login';
import StockList from "../components/Stock/StockList";
import OrderList from "../components/Order/OrderList";
import CompareList from "@/components/Compare/CompareList";
import KeyList from "../components/Key/KeyList";
import UsersList from "../components/Users/List";
import UserEdit from "../components/Users/Edit";

import CompareHeader from "@/components/Compare/CompareHeader";
import OrderHeader from "@/components/Order/OrderHeader";

import store from "../store";

Vue.use(VueRouter);

const routes = [
    { name: 'home', path: '/', components: {content: Home}, meta: {requiresAuth: true, group: 'home'} },
    { name: 'login', path: '/login', components: {content: Login} },
    { name: 'stockList', path: '/stock/', components: {content: StockList, header: CompareHeader}, meta: {requiresAuth: true, group: 'stockList'} },
    { name: 'compareList', path: '/compare/', components: {content: CompareList, header: CompareHeader}, meta: {requiresAuth: true, group: 'compareList'} },
    { name: 'orderList', path: '/order/', components: {content: OrderList, header: OrderHeader}, meta: {requiresAuth: true, group: 'orderList'} },
    { name: 'keyList', path: '/key/', components: {content: KeyList}, meta: {requiresAuth: true, group: 'keyList'} },
    { name: 'usersList', path: '/users/', components: {content: UsersList}, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userNew', path: '/user/new', components: {content: UserEdit}, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userEdit', path: '/user/:id', components: {content: UserEdit}, meta: {requiresAuth: true, group: 'usersList'} },
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