import axios from "axios";
import moment from "moment";

const LOGIN_TTL_SECONDS = 86400;

export default {
    state: {
        list: [],
        localTried: false,
        edit: false,
        current: false,
        currentFilter: {}
    },
    getters: {
        isLoggedIn(state) {
            return state.current && state.current.id;
        },
        userHasRights(state) {
            return (right) => {
                return state.current && (
                    right === 'home' ||
                    state.current.isAdmin || (
                        state.current.rights && state.current.rights.indexOf(right) !== -1
                    )
                );
            }
        }
    },
    actions: {
        async loadUsers({commit}, filter = {}) {
            let response = await axios.post(`/api/user/list`, {filter});
            await commit('setFilter', filter);
            return commit('setUsers', response.data.users);
        },
        async setEditUser({commit, state}, userId) {
            let user = state.list.find(item => item.id === userId);
            if (user) {
                commit('setEditUser', user);
            }
        },
        async newUser({dispatch, state}, user) {
            let result = await axios.post(`/api/user/add`, {user});
            dispatch('setEditUser', result.data.user);
            return dispatch('loadUsers', state.filter);
        },
        async editUser({dispatch, commit, state}, user) {
            try {
                let response = await axios.post(`/api/user/update`, {user});
                let isSuccess = response && response.data && response.data.user && response.data.user.id;
                if (isSuccess) {
                    commit('setSuccessMessage', 'Данные сохранены!');
                }
                else {
                    commit('setErrorMessage', 'Ошибка сохранения данных!');
                }
            }
            catch (e) {
                commit('setErrorMessage', 'Ошибка сохранения данных!')
            }

            return dispatch('loadUsers', state.filter);
        },
        async loginLocalUser({commit, state}) {
            if (state.localTried) {
                return;
            }

            await commit('setLocalTried', true);
            let savedUser = localStorage.getItem('currentUser');
            if (!savedUser) {
                return;
            }

            let user = JSON.parse(savedUser);

            let lastLogin = moment.unix(user.loggedIn);
            let secondsSinceLogin = moment().diff(lastLogin, 'seconds');
            if (secondsSinceLogin > LOGIN_TTL_SECONDS) {
                return;
            }

            let response = await axios.post(`/api/user/check`, {id: user.id});
            let isSuccess = response && response.data && response.data.success === true;
            if (isSuccess) {
                return commit('setCurrentUser', user);
            }
        },
        async saveLoggedInUser(_, user) {
            user.loggedIn = moment().unix();
            localStorage.setItem('currentUser', JSON.stringify(user));
        },
        async loginUser({dispatch, commit}, {login, password}) {
            try {
                let response = await axios.post(`/api/user/login`, {login, password});
                let isSuccess = response && response.data && response.data.user && response.data.user.id;
                let user = isSuccess ? response.data.user : false;
                if (isSuccess) {
                    commit('setCurrentUser', user);
                    dispatch('saveLoggedInUser', user);
                    commit('setSuccessMessage', 'Вы вошли в систему');
                }
                else {
                    commit('setErrorMessage', 'Ошибка входа!' + (response.data.error ? ' ' + response.data.error : ''));
                }
            }
            catch (e) {
                commit('setErrorMessage', 'Ошибка входа!')
            }
        },
        async logoutUser({commit}) {
            localStorage.removeItem('currentUser');
            return commit('setCurrentUser', false);
        },
        async deleteUser({dispatch, state}, user) {
            await axios.post(`/api/user/delete`, {user});
            return dispatch('loadUsers', state.filter);
        },
    },
    mutations: {
        setUsers(state, users) {
            state.list = users;
        },
        setEditUser(state, user) {
            state.edit = user;
        },
        setCurrentUser(state, user) {
            state.current = user;
        },
        setFilter(state, filter) {
            state.currentFilter = filter;
        },
        setLocalTried(state, tried) {
            state.localTried = tried;
        }
    }
}