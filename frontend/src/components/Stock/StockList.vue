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
                    item-key="_id"
                    locale="ru"
                >
                    <template v-slot:top>
                        <filter-field v-model="filter" :fields="filterFields" label="Фильтр" outlined class="mb-6" @save="saveFilter"></filter-field>
                    </template>
                    <template v-slot:item.size="{ item }">
                        {{[item.size.ru, item.size.de].filter(size => Boolean(size)).join('/')}}
                    </template>
                    <template v-slot:item.keyId="{item}">
                        {{sourceTitle(item.keyId)}}
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import FilterField from "../Filter/Filter"
    import clone from "lodash.clonedeep";

    export default {
        components: {FilterField},
        data() {
            return {
                defaultItem: {},
                editedIndex: null,
                editedItem: null,

                editDialog: false,
                deleteDialog: false,

                loading: false,
                unsaved: false,
                options: {},

                filter: {},

                headers: [
                  {text: 'Источник', value: 'keyId'},
                  {text: 'Название', value: 'title'},
                  {text: 'Цвет', value: 'color'},
                  {text: 'Размер', value: 'size'},
                  {text: 'Артикул', value: 'sku'},
                  {text: 'Штрих-код', value: 'barcode'},
                  {text: 'Кол-во', value: 'quantity'},
                  {text: 'Цена', value: 'price'},
                  //{text: 'Действия', value: 'actions', sortable: false, width: '20%'},
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
            await this.loadKeys();
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
                let filter = clone(this.filter);
                if (this.filter.keyId && this.filter.keyId.length === 1 && this.filter.keyId[0] === null) {
                    filter['source'] = '1c';
                }

                if (!this.filter.keyId) {
                    filter['source'] = '1c';
                }

                await this.$store.dispatch('stock/loadItems', {filter, sort, limit, offset});
                this.loading = false;
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
                if (typeof (searchValue) === 'undefined') {
                    searchValue = null;
                }

                let source = this.sources.find(source => source.value === searchValue);
                return source ? source.text : null;
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
                let sources = [{text: '1C', value: null}];
                let keys = this.$store.state.key.list;
                if (keys) {
                    for (let key of this.$store.state.key.list) {
                        sources.push({text: key.title, value: key.id});
                    }
                }

                return sources;
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