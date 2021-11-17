<template>
    <v-container class="fill-height align-start">
        <v-row align="start" justify="start">
            <v-col cols="12">
                <v-data-table
                    dense
                    :headers="visibleHeaders"
                    :items="items"
                    :loading="loading"
                    :options.sync="options"
                    :server-items-length="totalItems"
                    :items-per-page="15"
                    multi-sort
                    show-group-by
                    item-key="_id"
                    locale="ru"
                    :footer-props="{'items-per-page-options': [15, 50, 100, 500, -1]}"
                >
                    <template v-slot:top>
                        <filter-field v-model="filter" :fields="filterFields" label="Фильтр" outlined class="mb-6" @save="saveFilter"></filter-field>
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <div class="actions d-flex flex-row">
                            <v-btn icon small @click="completeItem(item)"><v-icon>mdi-check</v-icon></v-btn>
                            <products-dialog v-model="productDialogs[item.id]" :products="item.products" :order-id="item.id">
                                <template v-slot:activator="{ on, attrs }">
                                    <v-btn icon small v-bind="attrs" v-on="on"><v-icon>mdi-tshirt-v</v-icon></v-btn>
                                </template>
                            </products-dialog>
                            <raw-data-dialog v-model="rawDataDialogs[item.id]" :raw="item.raw" :order-id="item.id">
                                <template v-slot:activator="{ on, attrs }">
                                    <v-btn icon small v-bind="attrs" v-on="on"><v-icon>mdi-bug</v-icon></v-btn>
                                </template>
                            </raw-data-dialog>
                        </div>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import moment from "moment"
    import FilterField from "../Filter/Filter"
    import ProductsDialog from "@/components/Order/ProductsDialog";
    import RawDataDialog from "@/components/Order/RawDataDialog";

    export default {
        components: {FilterField, ProductsDialog, RawDataDialog},
        data() {
            return {
                loading: false,
                options: {
                    sortBy: ['updated'],
                    sortDesc: [true],
                    itemsPerPage: 15,
                },
                filter: {},
                productDialogs: {},
                rawDataDialogs: {},

                allHeaders: [
                    {text: 'Источник данных', value: 'sourceType'},
                    {text: 'Тип заказа', value: 'orderType'},
                    {text: 'Канал', value: 'source'},
                    {text: 'Продавец', value: 'keyId', width: '20%'},
                    {text: 'Заказ', value: 'id'},
                    {text: 'Обновлен', value: 'updated'},
                    {text: 'Создан', value: 'created'},
                    {text: 'Статус', value: 'statusText', width: '30%'},
                    {text: 'Сумма', value: 'price'},
                    {text: 'Отменен', value: 'canceled'},
                    {text: 'Выполнен', value: 'completed'},
                    {text: 'Действия', value: 'actions', sortable: false, width: '10%'},
                ],
            }
        },
        async created() {
            this.initFilter();
        },
        async mounted() {
            await this.loadEnums();
            await this.loadItems();
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
        methods: {
            initFilter() {
                let defaultFilter = {orderType: ['FBS'], source: ['wildberries'], completed: false, canceled: false};
                let savedFilter = localStorage.getItem('savedFilter');
                if (!savedFilter) {
                    this.filter = defaultFilter;
                    return;
                }

                this.filter = JSON.parse(savedFilter);
            },
            saveFilter() {
                localStorage.setItem('savedFilter', JSON.stringify(this.filter));
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

                await this.$store.dispatch('order/loadItems', {filter: this.filter, sort, limit, offset});
                this.loading = false;
            },
            async loadEnums() {
                this.loading = true;
                await this.$store.dispatch('order/loadFilterEnums');
                this.loading = false;
            },
            async completeItem(order) {
                if (order) {
                    let sourceOrder = this.sourceOrder(order._id);
                    sourceOrder.completed = moment().unix()
                    await this.$store.dispatch('order/saveItem', sourceOrder);
                }

                return this.loadItems();
            },
            sourceOrder(orderKey) {
                return this.$store.state.order.list.find(order => order._id === orderKey);
            }
        },
        computed: {
            keys() {
                return this.$store.state.key.list.reduce((aggr, key) => {
                    aggr[key.id] = key.title;
                    return aggr;
                }, {});
            },
            visibleHeaders() {
                return this.allHeaders;
            },
            items() {
                return this.loading
                    ? []
                    : this.$store.state.order.list.map(order => {
                        return {
                            _id: order._id,
                            orderType: order.orderType,
                            sourceType: order.sourceType,
                            source: order.source,
                            keyId: this.keys[order.keyId],
                            id: order.id,
                            updated: moment.unix(order.updated).format('DD.MM.YYYY'),
                            created: moment.unix(order.created).format('DD.MM.YYYY'),
                            statusText: order.statusText,
                            price: order.price / 100,
                            products: order.products,
                            canceled: order.canceled ? moment.unix(order.canceled).format('DD.MM.YYYY') : '',
                            completed: order.completed ? moment.unix(order.completed).format('DD.MM.YYYY') : '',
                            raw: order.raw
                        }
                    });
            },
            totalItems() {
                return this.$store.state.order.totalCount;
            },
            orderTypes() {
                return this.$store.state.order.filterFieldEnums && this.$store.state.order.filterFieldEnums.orderType
                    ? this.$store.state.order.filterFieldEnums.orderType.map(item => ({text: item.text, value: item.id}))
                    : [];
            },
            sourceTypes() {
                return this.$store.state.order.filterFieldEnums && this.$store.state.order.filterFieldEnums.source
                    ? this.$store.state.order.filterFieldEnums.source.map(item => ({text: item.text, value: item.id}))
                    : [];
            },
            statusTypes() {
                return this.$store.state.order.filterFieldEnums && this.$store.state.order.filterFieldEnums.status
                    ? this.$store.state.order.filterFieldEnums.status.map(item => ({text: item.text, value: item.id}))
                    : [];
            },
            filterFields() {
                let keys = this.$store.state.key.list.map(item => ({text: item.title, value: item.id}));

                return [
                    {text: 'Канал', id: 'source', type: 'select', items: this.sourceTypes, attrs: {multiple: true}},
                    {text: 'Заказ', id: 'id'},
                    {text: 'Штрихкод', id: 'barcode'},
                    {text: 'Тип заказа', id: 'orderType', type: 'select', items: this.orderTypes, attrs: {multiple: true}},
                    {text: 'Продавец', id: 'keyId', type: 'select', items: keys, attrs: {multiple: true}},
                    {text: 'Статус', id: 'statusText', type: 'select', items: this.statusTypes, attrs: {multiple: true}},
                    {text: 'Выполнен', id: 'completed', type: 'dateFlag'},
                    {text: 'Отменен', id: 'canceled', type: 'dateFlag'},
                ]
            }
        }
    }
</script>