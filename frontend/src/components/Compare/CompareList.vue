<template>
    <v-container class="fill-height align-start">
        <v-row align="start" justify="start">
            <v-col cols="12">
                <v-data-table
                    dense
                    v-model="selected"
                    :headers="headers"
                    :items="items"
                    :loading="loading"
                    :options.sync="options"
                    :server-items-length="totalItems"
                    :items-per-page="15"
                    multi-sort
                    show-select
                    selectable-key="barcode"
                    item-key="barcode"
                    locale="ru"
                >
                    <template v-slot:top>
                        <filter-field v-model="filter" :fields="filterFields" label="Фильтр" outlined class="mb-6" @save="saveFilter"></filter-field>
                    </template>
                    <template v-slot:item.title="{item}">
                        <div>{{item.title}}</div>
                        <small class="text--disabled" v-if="getInsalesTitle(item)" v-html="getInsalesTitle(item)"></small>
                    </template>
                    <template v-slot:footer.prepend>
                        <upload-stocks-dialog
                            v-model="upload"
                            :show="showUpload"
                            @show="toggleUploadDialog"
                            @ok="uploadStocks"
                        >
                            <template v-slot:activator="{ on, attrs }">
                                <v-btn color="primary"
                                    :disabled="selected && selected.length === 0"
                                    :loading="uploadJob !== false"
                                    v-bind="attrs" v-on="on"
                                >Отправить остатки</v-btn>
                            </template>
                        </upload-stocks-dialog>
                        <v-btn color="secondary"
                            :loading="loading"
                            outlined
                            class="ml-2"
                            @click="downloadCsv"
                        ><v-icon>mdi-download</v-icon> CSV</v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import FilterField from "../Filter/Filter"
    import UploadStocksDialog from "@/components/Compare/UploadStocksDialog";
    import moment from "moment";

    export default {
        components: {FilterField, UploadStocksDialog},
        data() {
            let matchFields = [
                {text: 'Штрихкод', value: 'barcode'},
                {text: 'Артикул', value: 'sku'}
            ];

            let compareFields = [
                {text: 'Количество', value: 'quantity'},
                {text: 'Цена', value: 'price'},
                {text: 'Артикул', value: 'sku'}
            ];

            return {
                loading: false,
                downloading: false,
                options: {},
                filter: {},
                ordersFilter: {},
                selected: [],
                upload: {},
                showUpload: false,
                lastBarcodes: [],

                matchFields,
                compareFields,
                defaultCompareField: 'quantity',
            }
        },
        watch: {
            filter: {
                deep: true,
                async handler() {
                    if (this.filter.onlyUnequal) {
                        this.options.itemsPerPage = -1;
                        this.options.page = 1;
                    }

                    await this.loadItems();
                }
            },
            options: {
                deep: true,
                handler() {
                    this.loadItems();
                }
            },
            async uploadJob() {
                if (this.uploadJob === false) {
                    await this.loadItems();
                }
            },
            async downloadJob() {
                if (this.downloadJob === false) {
                    await this.loadItems();
                }
            }
        },
        async created() {
            this.initFilter();
            this.initOrdersFilter();
        },
        async mounted () {
            await this.loadKeys();
            await this.loadOrderEnums();
            return this.loadItems();
        },
        methods: {
            initFilter() {
                let defaultFilter = {onlyMatched: true, matchField: 'barcode', compareField: this.defaultCompareField};
                let savedFilter = localStorage.getItem('savedCompareFilter');
                if (!savedFilter) {
                    this.filter = defaultFilter;
                    return;
                }

                this.filter = JSON.parse(savedFilter);
            },
            initOrdersFilter() {
                let defaultFilter = {orderType: ['FBS'], source: ['wildberries'], completed: false, canceled: false};
                let savedFilter = localStorage.getItem('savedFilter');
                if (!savedFilter) {
                    this.filter = defaultFilter;
                    return;
                }

                this.ordersFilter = JSON.parse(savedFilter);
            },
            saveFilter() {
                localStorage.setItem('savedCompareFilter', JSON.stringify(this.filter));
                this.$store.commit('setSuccessMessage', 'Фильтр сохранен!');
            },
            async loadKeys() {
                this.loading = true;
                await this.$store.dispatch('key/loadItems');
                this.loading = false;
            },
            downloadCsv() {
                return this.loadItems(true);
            },
            async loadItems(downloadAsCsv = false) {
                if (downloadAsCsv) {
                    this.downloading = true;
                }
                else {
                    this.loading = true;
                }

                let sort = this.options.sortBy && this.options.sortBy.length > 0
                    ? this.options.sortBy.reduce((sortFields, fieldId, index) => {
                        let isDesc = this.options.sortDesc[index];
                        sortFields[fieldId] = isDesc ? -1 : 1;
                        return sortFields;
                    }, {})
                    : {};
                let limit = this.options.itemsPerPage || 15;
                let page = this.options.page || 1;
                let offset = (page-1)*limit;

                let filter = {};
                if (this.filter.barcode) {
                    filter.barcode = this.filter.barcode;
                }
                if (this.filter.sku) {
                    filter.sku = this.filter.sku;
                }

                if (this.filter.useOrderFilter || this.filter.ordersDateFrom) {
                    filter.orders = this.filter.useOrderFilter
                        ? this.ordersFilter
                        : {};

                    let today = moment().startOf('d').unix();
                    filter.ordersDate = this.filter.ordersDateFrom
                        ? this.filter.ordersDateFrom
                        : today;
                }

                let params = {
                    downloadAsCsv,
                    matchField: this.matchField,
                    onlyMatched: Boolean(this.filter.onlyMatched)
                };

                await this.$store.dispatch('stock/loadCompareItems', {filter, sort, limit, offset, params});
                if (downloadAsCsv) {
                    this.downloading = false;
                }
                else {
                    this.loading = false;
                }
            },
            async loadOrderEnums() {
                this.loading = true;
                await this.$store.dispatch('order/loadFilterEnums');
                this.loading = false;
            },
            toggleUploadDialog(dialogIsShown) {
                this.showUpload = dialogIsShown;
            },
            uploadStocks() {
                let jobData = {
                    ids: this.selected.map(item => item.barcode),
                    idField: 'barcode',
                    from: this.upload.from,
                    to: this.upload.to
                }

                return this.$store.dispatch('job/uploadStocks', jobData);
            },
            getInsalesTitle(item) {
                let insalesKeys = Object.keys(item).filter(key => key.indexOf('insales') === 0);
                return insalesKeys.map(key => {
                    let insalesProducts = item.raw[key];
                    if (!insalesProducts) {
                        return false;
                    }

                    if (!(insalesProducts instanceof Array)) {
                        insalesProducts = [insalesProducts];
                    }

                    return insalesProducts.map(insalesProduct => `[${insalesProduct.sku}] ${insalesProduct.title}`).join('<br>');
                }).filter(title => title !== false).join('/') || '';
            }
        },
        computed: {
            keys() {
                return this.$store.state.key.list.reduce((aggr, key) => {
                    aggr[key.id] = key.title;
                    return aggr;
                }, {});
            },
            headers() {
                let matchBySku = this.filter && this.filter.matchField === 'sku';

                let baseHeaders = [
                    {text: matchBySku ? 'Артикул' : 'Штрих-код', value: matchBySku ? 'sku' : 'barcode'},
                    {text: 'Название', value: 'title'},
                    {text: 'Сколько в заказах', value: 'todaySum', sortable: false}
                ];

                let variants = this.$store.state.stock.compareVariants || [];
                let compareHeaders = variants.map(variant => ({
                    text: variant.keyId ? this.keys[variant.keyId] : variant.source,
                    value: variant.id,
                }));

                return baseHeaders.concat(compareHeaders);
            },
            items() {
                let items = this.loading
                    ? []
                    : this.$store.state.stock.compare || [];

                let compareItems = items;

                if (this.onlyUnequal) {
                    compareItems = compareItems.filter(item => item.allValuesEqual === false && item.allValuesZero === false);
                }

                return compareItems;
            },
            totalItems() {
                return this.onlyUnequal || this.onlyToday
                    ? this.items.length
                    : this.$store.state.stock.compareCount || 0;
            },
            sourceTypes() {
                return this.$store.state.order.filterFieldEnums && this.$store.state.order.filterFieldEnums.source
                    ? this.$store.state.order.filterFieldEnums.source.map(item => ({text: item.text, value: item.id}))
                    : [];
            },
            filterFields() {
                return [
                    {text: 'Искать совпадения по', id: 'matchField', type: 'select', single: true, items: this.matchFields},
                    {text: 'Сравнивать по', id: 'compareField', type: 'select', single: true, items: this.compareFields},
                    {text: 'Артикул', id: 'sku'},
                    {text: 'Штрихкод', id: 'barcode'},
                    {text: 'Только в нескольких источниках', id: 'onlyMatched', type: 'flag'},
                    {text: 'Только различия', id: 'onlyUnequal', type: 'flag'},
                    {text: 'Есть в заказах с даты', id: 'ordersDateFrom', type: 'date'},
                    {text: 'Использовать фильтр страницы заказов', id: 'useOrderFilter', type: 'flag'},
                ];
            },
            compareField() {
                return this.filter && this.filter.compareField
                    ? this.filter.compareField
                    : this.defaultCompareField;
            },
            matchField() {
                return this.filter.matchField || 'barcode';
            },
            todayOrders() {
                return this.loading
                    ? []
                    : this.$store.state.order.list || [];
            },
            onlyUnequal() {
                return typeof (this.filter.onlyUnequal) === 'boolean'
                    ? this.filter.onlyUnequal
                    : false;
            },
            onlyToday() {
                return this.filter.ordersDateFrom > 0;
            },
            todayStockCount() {
                let stockCount = {};
                for (let order of this.todayOrders) {
                    for (let product of order.products) {
                        let id = product[this.matchField];
                        if (typeof (stockCount[id]) === 'undefined') {
                            stockCount[id] = product[this.compareField];
                        }
                        else {
                            stockCount[id] += product[this.compareField];
                        }
                    }
                }

                return stockCount;
            },
            todayBarcodes() {
                return Object.keys(this.todayStockCount);
            },
            uploadJobs() {
                return this.$store.getters["job/uploadJobs"];
            },
            uploadJob() {
                return this.uploadJobs && this.uploadJobs.length > 0
                    ? this.uploadJobs[0]
                    : false
            },
            downloadJobs() {
                return this.$store.getters["job/downloadJobs"];
            },
            downloadJob() {
                return this.downloadJobs && this.downloadJobs.length > 0
                    ? this.downloadJobs[0]
                    : false
            }
        }
    }
</script>