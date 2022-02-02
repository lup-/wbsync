<template>
    <v-container class="align-start">
        <h2 class="mb-4 text--secondary">Наблюдения за ценами</h2>
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
                    Новое наблюдение
                    <v-spacer></v-spacer>
                    <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-title v-else>
                    {{editedItem.title}}
                    <v-spacer></v-spacer>
                    <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-text>
                    <parse-edit-form v-model="editedItem"></parse-edit-form>
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
    import ParseEditForm from "@/components/ParseProducts/ParseEditForm";
    import moment from "moment";

    export default {
        components: {ParseEditForm},
        data() {
            return {
                defaultItem: {},
                editedItem: null,

                editDialog: false,
                deleteDialog: false,

                loading: false,
                options: {},
            }
        },
        mounted () {
            this.loadItems();
        },
        methods: {
            async loadItems() {
                this.loading = true;
                await this.$store.dispatch('parse/loadItems');
                this.loading = false;
            },
            deleteItem(item) {
                this.$store.dispatch('parse/deleteItem', item);
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
                    let saveAction = this.isNewEditing ? 'parse/newItem' : 'parse/saveItem';
                    await this.$store.dispatch(saveAction, this.editedItem);
                }

                this.close();
                return this.loadItems();
            },

            getAllLinkDomains(items) {
                let domains = items
                    .reduce((domains, item) => {
                        let linkDomains = item.links.map(link => {
                            let url = new URL(link);
                            return url.hostname.toLowerCase();
                        });

                        domains = domains.concat(linkDomains);
                        return domains;
                    }, [])
                    .filter((domain, index, allDomains) => allDomains.indexOf(domain) === index);

                domains.sort();
                return domains;
            }
        },
        computed: {
            isNewEditing() {
                return this.editedItem && !this.editedItem._id;
            },
            headers() {
                let baseHeaders = [
                    {text: 'Название', value: 'title'},
                    {text: 'Обновлено', value: 'lastParsedTime'},
                ];

                if (!this.loading) {
                    let items = this.$store.state.parse.list;
                    let domains = this.getAllLinkDomains(items);
                    for (let domain of domains) {
                        baseHeaders.push({text: domain, value: domain});
                    }
                }

                baseHeaders.push({text: 'Действия', value: 'actions', sortable: false, width: '20%'});

                return baseHeaders;
            },
            items() {
                if (this.loading) {
                    return [];
                }

                let items = this.$store.state.parse.list;
                let domains = this.getAllLinkDomains(items);

                return items.map(item => {
                    let domainPrices = item.lastParsed && item.lastParsed.products
                        ? item.lastParsed.products.reduce((prices, product) => {
                            prices[product.host] = product.price;
                            return prices;
                          }, {})
                        : {};

                    for (let domain of domains) {
                        item[domain] = domainPrices[domain] || null;
                    }

                    item.lastParsedTime = item.lastParsed && item.lastParsed.parsed
                        ? moment.unix(item.lastParsed.parsed).format('DD.MM.YYYY, HH:mm')
                        : null;

                    return item;
                });
            },
            totalItems() {
                return this.items.length;
            }

        }
    }
</script>