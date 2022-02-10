import Crud from "./baseCrud";
import axios from "axios";
import moment from "moment";

const API_LIST_URL = `/api/stock/list`;
const API_ADD_URL = `/api/stock/add`;
const API_UPDATE_URL = `/api/stock/update`;
const API_DELETE_URL = `/api/stock/delete`;

const NAME_ITEMS = 'stock';
const NAME_ITEM = 'stock';

function downloadFile(data, filename, mime, bom) {
    let blobData = (typeof bom !== 'undefined') ? [bom, data] : [data]
    let blob = new Blob(blobData, {type: mime || 'application/octet-stream'});
    if (typeof window.navigator.msSaveBlob !== 'undefined') {
        window.navigator.msSaveBlob(blob, filename);
    }
    else {
        let blobURL = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(blob) : window.webkitURL.createObjectURL(blob);
        let tempLink = document.createElement('a');
        tempLink.style.display = 'none';
        tempLink.href = blobURL;
        tempLink.setAttribute('download', filename);
        if (typeof tempLink.download === 'undefined') {
            tempLink.setAttribute('target', '_blank');
        }

        document.body.appendChild(tempLink);
        tempLink.click();
        setTimeout(function() {
            document.body.removeChild(tempLink);
            window.URL.revokeObjectURL(blobURL);
        }, 200)
    }
}

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
        itemsCancel: [],
        compareCancel: [],
    },
    actions: {
        async loadItems({commit}, inputParams) {
            let {filter = {}, limit = 15, offset = 0, sort = {}, params = {}} = {...inputParams};

            if (!API_LIST_URL) {
                return;
            }

            await commit('cancelRequests', 'itemsCancel');

            const request = axios.CancelToken.source();
            await commit('addCancelToken', {type: 'itemsCancel', request});

            let download = params.downloadAsCsv || false;

            if (download) {
                let data = {filter, limit, offset, sort, ...params};
                try {
                    let response = await axios({
                        url: API_LIST_URL,
                        method: 'POST',
                        data,
                        responseType: 'blob',
                        cancelToken: request.token
                    });

                    downloadFile(response.data, `stocks_${moment().unix()}.csv`);
                }
                catch (e) {
                    if (e.constructor.name !== 'Cancel') {
                        throw e;
                    }
                }
            }
            else {
                try {
                    let response = await axios.post(
                        API_LIST_URL,
                        {filter, limit, offset, sort},
                        {cancelToken: request.token}
                    );

                    await commit('setParams', {filter, limit, offset, sort});
                    await commit('setTotalCount', response.data['totalCount']);
                    return commit('setItems', response.data[NAME_ITEMS]);
                }
                catch (e) {
                    if (e.constructor.name !== 'Cancel') {
                        throw e;
                    }
                }
            }
        },
        async loadCompareItems({commit}, inputParams) {
            let {filter = {}, limit = 15, offset = 0, sort = {}, params = {}} = {...inputParams};

            if (!API_LIST_URL) {
                return;
            }

            await commit('cancelRequests', 'compareCancel');

            const request = axios.CancelToken.source();
            await commit('addCancelToken', {type: 'compareCancel', request});
            let download = params.downloadAsCsv || false;

            if (download) {
                let data = {filter, limit, offset, sort, ...params};
                try {
                    let response = await axios({
                        url: '/api/stock/match',
                        method: 'POST',
                        data,
                        responseType: 'blob',
                        cancelToken: request.token
                    });
                    downloadFile(response.data, `compare_${moment().unix()}.csv`);
                }
                catch (e) {
                    if (e.constructor.name !== 'Cancel') {
                        throw e;
                    }
                }
            }
            else {
                try {
                    let response = await axios.post(
                        '/api/stock/match',
                        {filter, limit, offset, sort, ...params},
                        {cancelToken: request.token}
                    );
                    await commit('setCompareParams', {filter, limit, offset, sort});
                    await commit('setCompareTotalCount', response.data['totalCount']);
                    await commit('setCompareVariants', response.data['variants']);
                    await commit('setCompareItems', response.data['compare']);
                }
                catch (e) {
                    if (e.constructor.name !== 'Cancel') {
                        throw e;
                    }
                }
            }
        },
        async loadProductCompareItems({commit}, inputParams) {
            let {filter = {}, limit = 15, offset = 0, sort = {}, params = {}} = {...inputParams};

            if (!API_LIST_URL) {
                return;
            }

            await commit('cancelRequests', 'compareCancel');

            const request = axios.CancelToken.source();
            await commit('addCancelToken', {type: 'compareCancel', request});
            let download = params.downloadAsCsv || false;

            if (download) {
                let data = {filter, limit, offset, sort, ...params};
                try {
                    let response = await axios({
                        url: '/api/stock/matchWithProducts',
                        method: 'POST',
                        data,
                        responseType: 'blob',
                        cancelToken: request.token
                    });
                    downloadFile(response.data, `compare_${moment().unix()}.csv`);
                }
                catch (e) {
                    if (e.constructor.name !== 'Cancel') {
                        throw e;
                    }
                }
            }
            else {
                try {
                    let response = await axios.post(
                        '/api/stock/matchWithProducts',
                        {filter, limit, offset, sort, ...params},
                        {cancelToken: request.token}
                    );
                    await commit('setCompareParams', {filter, limit, offset, sort});
                    await commit('setCompareTotalCount', response.data['totalCount']);
                    await commit('setCompareVariants', response.data['variants']);
                    await commit('setCompareItems', response.data['compare']);
                }
                catch (e) {
                    if (e.constructor.name !== 'Cancel') {
                        throw e;
                    }
                }
            }
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
        },
        cancelRequests(state, type) {
            for (const request of state[type]) {
                request.cancel();
            }

            state[type] = [];
        },
        addCancelToken(state, {type, request}) {
            state[type].push(request);
        }
    }
});