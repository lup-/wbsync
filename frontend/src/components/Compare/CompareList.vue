<template>
    <v-container class="fill-height align-start">
        <v-row align="start" justify="start">
            <v-col cols="12">
                <v-data-table
                    dense
                    :headers="headers"
                    :items="items"
                    :loading="loading"
                    :options.sync="options"
                    :server-items-length="totalItems"
                    :items-per-page="15"
                    multi-sort
                    item-key="id"
                    locale="ru"
                >
                    <template v-slot:top>
                        <filter-field v-model="filter" :fields="filterFields" label="Фильтр" outlined class="mb-6" @save="saveFilter"></filter-field>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import FilterField from "../Filter/Filter"
    import moment from "moment";

    export default {
        components: {FilterField},
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
                options: {},
                filter: {},

                matchFields,
                compareFields,
                defaultCompareField: 'quantity',
            }
        },
        watch: {
            filter: {
                deep: true,
                handler() {
                    this.loadItems();
                }
            },
            options: {
                deep: true,
                handler() {
                    this.loadItems();
                }
            }
        },
        async created() {
            this.initFilter();
        },
        async mounted () {
            await this.loadKeys();
            await this.loadOrderEnums();
            await this.loadTodayOrders();
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
            saveFilter() {
                localStorage.setItem('savedCompareFilter', JSON.stringify(this.filter));
                this.$store.commit('setSuccessMessage', 'Фильтр сохранен!');
            },
            async loadKeys() {
                this.loading = true;
                await this.$store.dispatch('key/loadItems');
                this.loading = false;
            },
            async loadItems() {
                this.loading = true;
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

                let params = {
                    matchField: this.matchField,
                    onlyMatched: Boolean(this.filter.onlyMatched)
                };

                await this.$store.dispatch('stock/loadCompareItems', {filter, sort, limit, offset, params});
                this.loading = false;
            },
            async loadTodayOrders() {
                this.loading = true;
                let today = moment().startOf('d').unix();
                let limit = -1;
                let offset = 0;
                let sort = {updated: -1};
                let filter = {updated: {$gte: today}};

                await this.$store.dispatch('order/loadItems', {filter, sort, limit, offset});
                this.loading = false;
            },
            async loadOrderEnums() {
                this.loading = true;
                await this.$store.dispatch('order/loadFilterEnums');
                this.loading = false;
            },
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
                    {text: 'Сегодня заказано', value: 'todaySum', sortable: false}
                ];

                let variants = this.$store.state.stock.compareVariants || [];
                let compareHeaders = variants.map(variant => ({
                    text: variant.keyId ? this.keys[variant.keyId] : variant.source,
                    value: variant.id,
                }));

                return baseHeaders.concat(compareHeaders);
            },
            items() {
                let variants = this.$store.state.stock.compareVariants || [];
                let compareField = this.compareField;
                let items = this.loading
                    ? []
                    : this.$store.state.stock.compare || [];

                return items.map(item => {
                        let compareItem = {};
                        if (item.sku) {
                            compareItem.sku = item.sku;
                        }

                        if (item.barcode) {
                            compareItem.barcode = item.barcode;
                        }

                        for (let variant of variants) {
                            let stockItem = item[variant.id];
                            let value = stockItem && typeof (stockItem[compareField]) !== 'undefined'
                                ? stockItem[compareField]
                                : null;

                            compareItem[variant.id] = value;
                        }

                        compareItem.todaySum = this.todayStockCount[item.id] || 0;

                        return compareItem;
                    });
            },
            totalItems() {
                return this.$store.state.stock.compareCount || 0;
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
                    {text: 'Канал для кол-ва в заказах', id: 'source', type: 'select', items: this.sourceTypes, attrs: {multiple: true}},
                    {text: 'Артикул', id: 'sku'},
                    {text: 'Штрихкод', id: 'barcode'},
                    {text: 'Только совпадения', id: 'onlyMatched', type: 'flag'},
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
            }
        }
    }
</script>