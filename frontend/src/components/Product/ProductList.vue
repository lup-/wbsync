<template>
    <v-container class="align-start">
        <h2 class="mb-4 text--secondary">Товары в базе</h2>
        <v-row align="start" justify="start">
            <v-col cols="12">
                <v-data-table
                        dense
                        :headers="headers"
                        :items="items"
                        :loading="loading"
                        :options.sync="options"
                        :server-items-length="totalItems"
                        :items-per-page="50"
                        fixed-header
                        :height="$store.state.tableHeight"
                        locale="ru"
                        :footer-props="{'items-per-page-options': [15, 50, 100, 500, -1]}"
                >
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon small @click="editItem(item)"><v-icon>mdi-pencil</v-icon></v-btn>
                        <v-btn icon small color="red" @click="deleteItem(item)"><v-icon>mdi-delete</v-icon></v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>

        <v-btn fab bottom right fixed large color="primary" @click="newItem"><v-icon>mdi-plus</v-icon></v-btn>

        <v-dialog
                v-model="editDialog"
                max-width="90%"
        >
            <v-card v-if="editedItem">
                <v-card-title v-if="isNewEditing">
                    Новый товар
                    <v-spacer></v-spacer>
                    <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-title v-else>
                    {{editedItem.title}}
                    <v-spacer></v-spacer>
                    <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-subtitle v-if="!isNewEditing">{{editedProductType.title}}</v-card-subtitle>
                <v-card-text>
                    <product-edit-form v-model="editedItem" :product-types="productTypes"></product-edit-form>
                </v-card-text>
                <v-card-actions>
                    <v-btn text @click="close">Отмена</v-btn>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" large @click="save">Сохранить</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

    </v-container>
</template>

<script>
    import ProductEditForm from "@/components/Product/ProductEditForm";

    export default {
        components: {ProductEditForm},
        data() {
            return {
                defaultItem: {},
                editedItem: null,

                editDialog: false,
                deleteDialog: false,

                loading: false,
                options: {},

                headers: [
                    {text: 'Штрихкод', value: 'barcode'},
                    {text: 'Название', value: 'title'},
                    {text: 'Тип', value: 'productType'},
                    {text: 'Действия', value: 'actions', sortable: false, width: '20%'},
                ],
            }
        },
        async mounted () {
            await this.loadItems();
            await this.loadProductTypes();
        },
        watch: {
            filter: {
                deep: true,
                async handler() {
                    await this.loadItems();
                }
            },
            options: {
                deep: true,
                handler() {
                    this.loadItems();
                }
            },
        },
        methods: {
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

                await this.$store.dispatch('product/loadItems', {filter, sort, limit, offset});
                this.loading = false;
            },
            async loadProductTypes() {
                this.loading = true;
                await this.$store.dispatch('productType/loadItems');
                this.loading = false;
            },
            deleteItem(item) {
                this.$store.dispatch('product/deleteItem', item);
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
                    let saveAction = this.isNewEditing ? 'product/newItem' : 'product/saveItem';
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
                if (this.loading) {
                    return [];
                }

                let typeMap = this.productTypes.reduce((typeMap, type) => {
                    typeMap[type.id] = type.title;
                    return typeMap;
                }, {})

                return this.$store.state.product.list.map(product => {
                    product.productType = typeMap[product.productTypeId];
                    return product;
                });
            },
            editedProductType() {
                if (!this.editedItem || !this.productTypes) {
                    return null;
                }

                return this.productTypes.find(type => type.id === this.editedItem.productTypeId);

            },
            productTypes() {
                return this.loading
                    ? []
                    : this.$store.state.productType.list;
            },
            totalItems() {
                return this.$store.state.product.totalCount;
            },

        }
    }
</script>