<template>
    <v-container class="align-start">
        <h2 class="mb-4 text--secondary">Поставки</h2>
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
                >
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon small @click="editItem(item)"><v-icon>mdi-pencil</v-icon></v-btn>
                        <v-btn icon small @click="loadProducts(item)"><v-icon>mdi-tshirt-v</v-icon></v-btn>
                        <v-btn icon small color="red" @click="deleteItem(item)"><v-icon>mdi-delete</v-icon></v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>

        <v-row align="start" justify="start" v-if="selectedSupply">
            <h3 class="mb-4 text--secondary">Товары в поставке</h3>
            <v-col cols="12">
                <v-data-table
                    dense
                    :headers="productHeaders"
                    :items="products"
                    :loading="loadingProducts"
                    :options.sync="productOptions"
                    :server-items-length="productTotalItems"
                    :items-per-page="50"
                >
                </v-data-table>
            </v-col>
        </v-row>

        <v-btn fab bottom right fixed large color="primary" @click="newItem"><v-icon>mdi-plus</v-icon></v-btn>

        <v-dialog
                v-model="editDialog"
                max-width="600px"
        >
            <v-card v-if="editedItem">
                <v-card-title v-if="isNewEditing">
                    Новая поставка
                    <v-spacer></v-spacer>
                    <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-title v-else>
                    {{editedItem.title}}
                    <v-spacer></v-spacer>
                    <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-text>
                    <supply-edit-form v-model="editedItem"></supply-edit-form>
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
    import SupplyEditForm from "@/components/Supply/SupplyEditForm";

    export default {
        components: {SupplyEditForm},
        data() {
            return {
                defaultItem: {},
                editedItem: null,

                editDialog: false,
                deleteDialog: false,

                loading: false,
                loadingProducts: false,
                options: {},
                productOptions: {},
                selectedSupply: null,

                headers: [
                  {text: 'Название', value: 'title'},
                  {text: 'Действия', value: 'actions', sortable: false, width: '20%'},
                ],
            }
        },
        mounted () {
            this.loadItems();
        },
        watch: {
            productOptions: {
                deep: true,
                handler() {
                    this.loadProducts(this.selectedSupply);
                }
            }
        },
        methods: {
            async loadItems() {
                this.loading = true;
                await this.$store.dispatch('supply/loadItems');
                await this.$store.dispatch('productType/loadItems');
                this.loading = false;
            },
            async loadProducts(supply) {
                this.selectedSupply = supply;
                this.$store.commit('supply/setSupplyProductsTotalCount', 0);
                this.$store.commit('supply/setSupplyProducts', []);

                this.loadingProducts = true;

                let sort = this.productOptions.sortBy && this.productOptions.sortBy.length > 0
                    ? this.productOptions.sortBy.reduce((sortFields, fieldId, index) => {
                        let isDesc = this.productOptions.sortDesc[index];
                        sortFields[fieldId] = isDesc ? -1 : 1;
                        return sortFields;
                    }, {})
                    : {};
                let limit = this.productOptions.itemsPerPage || 15;
                let page = this.productOptions.page || 1;
                let offset = (page-1)*limit;

                await this.$store.dispatch('supply/loadProducts', {sort, limit, offset, supply});
                this.loadingProducts = false;
            },
            deleteItem(item) {
                this.$store.dispatch('supply/deleteItem', item);
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
                    let saveAction = this.isNewEditing ? 'supply/newItem' : 'supply/saveItem';
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
                    : this.$store.state.supply.list;
            },
            totalItems() {
                return this.$store.state.supply.totalCount || 0;
            },
            products() {
                return this.loadingProducts
                    ? []
                    : this.$store.state.supply.supplyProducts;
            },
            productType() {
                if (!this.selectedSupply) {
                    return null;
                }

                return this.$store.state.supply.selectedProductType;
            },
            productTotalItems() {
                return this.$store.state.supply.supplyProductsTotalCount || 0;
            },
            productHeaders() {
                if (!this.productType) {
                    return [];
                }

                return this.productType.fields.map(field => {
                    return {text: field.title, value: field.code};
                });
            }
        }
    }
</script>