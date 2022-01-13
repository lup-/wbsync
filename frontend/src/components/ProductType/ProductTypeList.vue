<template>
    <v-container class="align-start">
        <h2 class="mb-4 text--secondary">Типы товаров</h2>
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
                        <v-btn icon small color="red" @click="deleteItem(item)"><v-icon>mdi-delete</v-icon></v-btn>
                    </template>
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
                    Новый тип товаров
                    <v-spacer></v-spacer>
                    <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-title v-else>
                    {{editedItem.title}}
                    <v-spacer></v-spacer>
                    <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-text>
                    <product-type-edit-form v-model="editedItem"></product-type-edit-form>
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
    import ProductTypeEditForm from "@/components/ProductType/ProductTypeEditForm";

    export default {
        components: {ProductTypeEditForm},
        data() {
            return {
                defaultItem: {},
                editedItem: null,

                editDialog: false,
                deleteDialog: false,

                loading: false,
                options: {},

                headers: [
                  {text: 'Название', value: 'title'},
                  {text: 'Действия', value: 'actions', sortable: false, width: '20%'},
                ],
            }
        },
        mounted () {
            this.loadItems();
        },
        methods: {
            async loadItems() {
                this.loading = true;
                await this.$store.dispatch('productType/loadItems');
                this.loading = false;
            },
            deleteItem(item) {
                this.$store.dispatch('productType/deleteItem', item);
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
                    let saveAction = this.isNewEditing ? 'productType/newItem' : 'productType/saveItem';
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
                    : this.$store.state.productType.list;
            },
            totalItems() {
                return this.items.length;
            }

        }
    }
</script>