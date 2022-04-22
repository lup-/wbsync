<template>
    <v-container class="align-start">
        <h2 class="mb-4 text--secondary">Товары</h2>
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
                    fixed-header
                    :height="$store.state.tableHeight"
                    multi-sort
                    item-key="_id"
                    locale="ru"
                    :footer-props="{'items-per-page-options': [15, 50, 100, 500, -1]}"
                >
                    <template v-slot:top>
                        <filter-field v-model="filter" :fields="filterFields" label="Фильтр" outlined class="mb-6" @save="saveFilter"></filter-field>
                    </template>
                    <template v-slot:item.size="{ item }">
                        {{[item.size.ru, item.size.de, item.size.any].filter(size => Boolean(size)).join('/')}}
                    </template>
                    <template v-slot:item.keyId="{item}">
                        {{sourceTitle(item.keyId)}}
                    </template>
                    <template v-slot:item.price="{item}">
                        {{item.price ? item.price / 100 : ''}}
                    </template>
                    <template v-slot:item.actions="{item}">
                        <raw-data-dialog v-model="rawDataDialogs[item.id]" :raw="item.raw" :order-id="item.id">
                            <template v-slot:activator="{ on, attrs }">
                                <v-btn icon small v-bind="attrs" v-on="on"><v-icon>mdi-bug</v-icon></v-btn>
                            </template>
                        </raw-data-dialog>
                    </template>

                    <template v-slot:footer.prepend>
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
    import RawDataDialog from "@/components/Order/RawDataDialog";
    import clone from "lodash.clonedeep";

    export default {
        components: {FilterField, RawDataDialog},
        data() {
            return {
                defaultItem: {},
                editedIndex: null,
                editedItem: null,

                editDialog: false,
                deleteDialog: false,

                loading: false,
                downloading: false,
                unsaved: false,
                options: {},

                filter: {},
                rawDataDialogs: {},

                headers: [
                  {text: 'Источник', value: 'keyId'},
                  {text: 'Название', value: 'title'},
                  {text: 'Цвет', value: 'color'},
                  {text: 'Размер', value: 'size'},
                  {text: 'Артикул', value: 'sku'},
                  {text: 'Штрих-код', value: 'barcode'},
                  {text: 'Кол-во', value: 'quantity'},
                  {text: 'Цена', value: 'price'},
                  {text: 'Действия', value: 'actions', sortable: false, width: '5%'},
                ],
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
            this.loadItems();
        },
        methods: {
            initFilter() {
                let defaultFilter = {hasQuantity: true, keyId: [null]};
                let savedFilter = localStorage.getItem('savedStockFilter');
                if (!savedFilter) {
                    this.filter = defaultFilter;
                    return;
                }

                this.filter = JSON.parse(savedFilter);
            },
            saveFilter() {
                localStorage.setItem('savedStockFilter', JSON.stringify(this.filter));
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
                let filter = clone(this.filter);
                if (this.filter.keyId && this.filter.keyId.length === 1 && this.filter.keyId[0] === null) {
                    filter['source'] = '1c';
                }

                if (!this.filter.keyId) {
                    filter['source'] = '1c';
                }

                let params = {downloadAsCsv};
                await this.$store.dispatch('stock/loadItems', {filter, sort, limit, offset, params});
                if (downloadAsCsv) {
                    this.downloading = false;
                }
                else {
                    this.loading = false;
                }
            },
            deleteItem(item) {
                this.$store.dispatch('stock/deleteItem', item);
            },
            editItem(item) {
                this.editedItem = Object.assign({}, item);
                this.editDialog = true;
            },
            newItem() {
                this.editedItem = Object.assign({}, this.defaultItem);
                this.editDialog = true;
            },

            close() {
                this.editDialog = false;
                this.editedItem = null;
            },

            async save() {
                if (this.editedItem !== null) {
                    let saveAction = this.isNewEditing ? 'stock/newItem' : 'stock/saveItem';
                    await this.$store.dispatch(saveAction, this.editedItem);
                }

                this.close();
                return this.loadItems();
            },
            sourceTitle(searchValue) {
                return this.$store.getters['key/sourceTitle'](searchValue);
            }
        },
        computed: {
            isNewEditing() {
                return this.editedItem && !this.editedItem._id;
            },
            items() {
                return this.loading
                    ? []
                    : this.$store.state.stock.list;
            },
            totalItems() {
                return this.$store.state.stock.totalCount;
            },
            sources() {
                return this.$store.getters["key/sources"];
            },
            filterFields() {
                return [
                    {text: 'Источник', id: 'keyId', type: 'select', items: this.sources, attrs: {multiple: true}},
                    {text: 'Артикул', id: 'sku'},
                    {text: 'Штрихкод', id: 'barcode'},
                    {text: 'Есть в остатках', id: 'hasQuantity', type: 'flag'},
                ];
            }
        }
    }
</script>