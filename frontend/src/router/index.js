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

import store from "../store";

Vue.use(VueRouter);

const routes = [
    { name: 'home', path: '/', component: Home, meta: {requiresAuth: true, group: 'home'} },
    { name: 'login', path: '/login', component: Login },
    { name: 'stockList', path: '/stock/', component: StockList, meta: {requiresAuth: true, group: 'stockList'} },
    { name: 'compareList', path: '/compare/', component: CompareList, meta: {requiresAuth: true, group: 'compareList'} },
    { name: 'orderList', path: '/order/', component: OrderList, meta: {requiresAuth: true, group: 'orderList'} },
    { name: 'keyList', path: '/key/', component: KeyList, meta: {requiresAuth: true, group: 'keyList'} },
    { name: 'usersList', path: '/users/', component: UsersList, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userEdit', path: '/user/:id', component: UserEdit, meta: {requiresAuth: true, group: 'usersList'} },
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