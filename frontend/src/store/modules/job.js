import axios from "axios";

const POLL_INTERVAL_MS = 5000;

async function waitForJobEnd(job, commit, type) {
    return new Promise(resolve => {
        let intervalId;
        intervalId = setInterval(async () => {
            let {data} = await axios.post('/api/job/status', {job, type});
            if (data && data.job) {
                if (data.job.status === 'succeeded') {
                    clearInterval(intervalId);
                    commit('setSuccessMessage', 'Задача выполнена!', { root: true });
                    commit('removeJob', job);
                    resolve(job);
                }
                else if (data.job.status === 'failed') {
                    clearInterval(intervalId);
                    commit('setErrorMessage', 'Ошибка выполнения задачи!', { root: true });
                    commit('removeJob', job);
                    resolve(job);
                }
            }
        }, POLL_INTERVAL_MS);

    });

}


export default {
    namespaced: true,
    state: {
        activeJobs: [],
    },
    getters: {
        uploadJobs(state) {
            return state.activeJobs.filter(job => job.data && job.data.type === 'upload');
        },
        downloadJobs(state) {
            return state.activeJobs.filter(job => job.data && job.data.type === 'download');
        },
        syncJobs(state) {
            return state.activeJobs.filter(job => job.data && job.data.type === 'sync');
        },
    },
    actions: {
        async uploadStocks({commit}, params) {
            let newJob = {
                type: 'upload',
                ids: params.ids,
                field: params.idField,
                from: params.from,
                to: params.to
            }

            let {data} = await axios.post(`/api/job/stocks`, {job: newJob});
            let createdJob = data.job;

            commit('setSuccessMessage', 'Отправка остатков запущена!', { root: true });

            await commit('addJob', createdJob);
            return waitForJobEnd(createdJob, commit, 'stocks');
        },
        async downloadStocks({commit}) {
            let newJob = {
                type: 'download',
            }

            let {data} = await axios.post(`/api/job/stocks`, {job: newJob});
            let createdJob = data.job;

            commit('setSuccessMessage', 'Получение остатков запущено!', { root: true });

            await commit('addJob', createdJob);
            return waitForJobEnd(createdJob, commit, 'stocks');
        },
        async syncOrders({commit}) {
            let {data} = await axios.post(`/api/job/orders`, {job: {type: 'sync'}});
            let createdJob = data.job;

            commit('setSuccessMessage', 'Синхронизация заказов запущена!', { root: true });

            await commit('addJob', createdJob);
            return waitForJobEnd(createdJob, commit, 'orders');
        },
    },
    mutations: {
        addJob(state, job) {
            state.activeJobs.push(job);
        },
        removeJob(state, job) {
            let jobIndex = state.activeJobs.findIndex(iterateJob => iterateJob.id === job.id);
            if (jobIndex !== -1) {
                state.activeJobs.splice(jobIndex, 1);
            }
        }
    }
}