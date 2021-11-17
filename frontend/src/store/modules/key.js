import Crud from "./baseCrud";

const API_LIST_URL = `/api/key/list`;
const API_ADD_URL = `/api/key/add`;
const API_UPDATE_URL = `/api/key/update`;
const API_DELETE_URL = `/api/key/delete`;

const NAME_ITEMS = 'keys';
const NAME_ITEM = 'key';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
}, {
    state: {
        types: [
            {text: 'Wildberries', value: 'wildberries'},
            {text: 'InSales', value: 'insales'},
            {text: 'Ozon', value: 'ozon'},
        ]
    },
    getters: {
        sources(state) {
            let sources = [{text: '1C', value: null}];
            let keys = state.list;
            if (keys) {
                for (let key of state.list) {
                    sources.push({text: key.title, value: key.id});
                }
            }

            return sources;
        },
        sourceTitle(state, getters) {
            return (searchValue) => {
                if (typeof (searchValue) === 'undefined') {
                    searchValue = null;
                }

                let source = getters.sources.find(source => source.value === searchValue);
                return source ? source.text : null;
            }
        },
        typeTitle(state) {
            return (searchType) => {
                if (searchType === '1c') {
                    return 'Файл';
                }

                let type = state.types.find(type => type.value === searchType);
                if (type) {
                    return type.text;
                }

                return '';
            }
        }
    }
});