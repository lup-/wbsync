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
                  {text: 'Название', value: 'title'},
                  {text: 'Цвет', value: 'color'},
                  {text: 'Размер', value: 'size'},
                  {text: 'Артикул', value: 'sku'},
                  {text: 'Штрих-код', value: 'barcode'},
                  {text: 'Кол-во', value: 'quantity'},
                  //{text: 'Действия', value: 'actions', sortable: false, width: '20%'},
                ],

                filterFields: [
                    {text: 'Артикул', id: 'sku'},
                    {text: 'Штрихкод', id: 'barcode'},
                    {text: 'Есть в остатках', id: 'hasQuantity', type: 'flag'},
                ]
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
        mounted () {
            this.loadItems();
        },
        methods: {
            initFilter() {
                let defaultFilter = {hasQuantity: true};
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
                filter['source'] = '1c';

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
            }
        }
    }
</script>