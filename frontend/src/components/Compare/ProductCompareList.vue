<template>
    <v-container class="align-start">
        <h2 class="mb-4 text--secondary">Сравнение остатков с внутренней базой</h2>
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
                    fixed-header
                    :height="$store.state.tableHeight"
                    selectable-key="_id"
                    item-key="_id"
                    locale="ru"
                    :footer-props="{'items-per-page-options': [15, 50, 100, 500, -1]}"
                >
                    <template v-slot:top>
                        <filter-field v-model="filter" :fields="filterFields" label="Фильтр" outlined class="mb-6" @save="saveFilter"></filter-field>
                    </template>
                    <template v-slot:item.barcode="{item}">
                        {{(item.barcode instanceof Array) ? item.barcode.join(', ') : item.barcode}}
                    </template>
                    <template v-slot:item.sku="{item}">
                        {{(item.sku instanceof Array) ? item.sku.join(', ') : item.sku}}
                        <small class="text--disabled" v-if="item.stockSku" v-html="item.stockSku.join(', ')"></small>
                    </template>
                    <template v-slot:footer.prepend>
                        <upload-stocks-dialog
                            v-model="upload"
                            :show="showUpload"
                            :skip-from="true"
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
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import FilterField from "../Filter/Filter"
    import UploadStocksDialog from "@/components/Compare/UploadStocksDialog";

    export default {
        components: {FilterField, UploadStocksDialog},
        data() {
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
            }
        },
        watch: {
            options: {
                deep: true,
                handler() {
                    this.loadItems();
                }
            },
            filter: {
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
        },
        async mounted () {
            return this.loadItems();
        },
        methods: {
            initFilter() {
                let defaultFilter = {
                    onlyMatched: true,
                    matchField: 'barcode',
                    compareField: this.defaultCompareField,
                };

                let savedFilter = localStorage.getItem('savedProductCompareFilter');
                if (!savedFilter) {
                    this.filter = defaultFilter;
                    return;
                }

                this.filter = JSON.parse(savedFilter);
            },
            saveFilter() {
                localStorage.setItem('savedProductCompareFilter', JSON.stringify(this.filter));
                this.$store.commit('setSuccessMessage', 'Фильтр сохранен!');
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

                let params = {
                    downloadAsCsv,
                    onlyUnequal: this.filter.onlyUnequal,
                };

                if (this.filter.compareSources) {
                    params.compareSources = this.filter.compareSources;
                }

                await this.$store.dispatch('stock/loadProductCompareItems', {filter, sort, limit, offset, params});
                if (downloadAsCsv) {
                    this.downloading = false;
                }
                else {
                    this.loading = false;
                }
            },
            toggleUploadDialog(dialogIsShown) {
                this.showUpload = dialogIsShown;
            },
            uploadStocks() {
                let jobData = {
                    ids: this.selected.map(item => item._id),
                    to: this.upload.to
                }

                return this.$store.dispatch('job/uploadProductStocks', jobData);
            },
        },
        computed: {
            keys() {
                return this.$store.state.key.list.reduce((aggr, key) => {
                    aggr[key.id] = key.title;
                    return aggr;
                }, {});
            },
            compareSources() {
                return this.$store.state.stock.compareVariants || [];
            },
            compareSourcesForSelect() {
                let externalSources = this.compareSources
                    .map(variant => ({
                        text: variant.keyId ? this.keys[variant.keyId] : variant.source,
                        value: variant.id,
                    }))
                    .filter(item => {
                        return Boolean(item.text);
                    });

                let internalSources = [{text: 'Внутренняя база', value: 'quantity'}];

                return internalSources.concat(externalSources);
            },
            headers() {
                let baseHeaders = [
                    {text: 'Штрих-код', value: 'barcode'},
                    {text: 'Артикул', value: 'sku', width: '100'},
                    {text: 'Название', value: 'title', width: '400'},
                ];

                let hasSelectedCompareSources = this.filter &&
                    this.filter.compareSources &&
                    this.filter.compareSources.length > 0;

                let compareHeaders = this.compareSourcesForSelect;

                if (hasSelectedCompareSources) {
                    compareHeaders = this.compareSourcesForSelect.filter(source => {
                        return this.filter.compareSources.includes(source.value);
                    });
                }

                return baseHeaders.concat(compareHeaders);
            },
            items() {
                if (this.loading) {
                    return [];
                }

                if (!this.$store.state.stock.compare) {
                    return [];
                }

                return this.$store.state.stock.compare.map(item => {
                    let itemWithStocks = {
                        _id: item._id,
                        barcode: item.barcode,
                        sku: item.sku,
                        stockSku: item.stockSku,
                        title: item.title,
                        quantity: item.quantity
                    }

                    if (item.stocks) {
                        for (let stock of item.stocks) {
                            let id = stock.keyId ? stock.source + '.' + stock.keyId : stock.source;
                            itemWithStocks[id] = stock.quantity || '';
                        }
                    }

                    return itemWithStocks;
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
                    {text: 'Каналы для сравнения', id: 'compareSources', type: 'select', items: this.compareSourcesForSelect, attrs: {multiple: true}},
                    {text: 'Артикул', id: 'sku'},
                    {text: 'Штрихкод', id: 'barcode'},
                    {text: 'Скрыть пустые и одинаковые остатки', id: 'onlyUnequal', type: 'flag'},
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
            onlyUnequal() {
                return typeof (this.filter.onlyUnequal) === 'boolean'
                    ? this.filter.onlyUnequal
                    : false;
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