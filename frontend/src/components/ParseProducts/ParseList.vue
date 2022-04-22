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
                        fixed-header
                        :height="$store.state.tableHeight"
                >
                    <template v-slot:[`item.${domain}`]="{ item }" v-for="domain in domains">
                        {{item[domain]}}
                        <v-btn icon small @click="editLink(domain, item)" :key="domain"><v-icon>mdi-pencil</v-icon></v-btn>
                    </template>
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
        <v-dialog
            v-model="linkDialog"
            max-width="600px"
        >
            <v-card v-if="editedLink">
                <v-card-title>
                    {{editedLink.name}}
                    <v-spacer></v-spacer>
                    <v-btn icon @click="closeLink"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-text>
                    <parse-link-form v-model="editedLink" @delete="deleteLink"></parse-link-form>
                </v-card-text>
                <v-card-actions>
                    <v-btn text @click="closeLink">Отмена</v-btn>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" large @click="saveLink">Сохранить</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

    </v-container>
</template>

<script>
    import ParseEditForm from "@/components/ParseProducts/ParseEditForm";
    import ParseLinkForm from "@/components/ParseProducts/ParseLinkForm";
    import moment from "moment";
    import clone from "lodash.clonedeep";

    export default {
        components: {ParseEditForm, ParseLinkForm},
        data() {
            return {
                defaultItem: {},
                editedItem: null,
                editedLink: null,
                editedLinkIndex: null,

                editDialog: false,
                linkDialog: false,
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
                    .reduce((domains, item, index) => {
                        let linkDomains = item.links.map(link => {
                            if (typeof (link) === 'object') {
                                if (link.name) {
                                    return link.name;
                                }

                                link = link.link;
                            }

                            if (link) {
                                let url = new URL(link);
                                return url.hostname.toLowerCase()
                                    .replace('www.', '')
                                    .trim();
                            }
                            else {
                                return `Ссылка ${index || 0 + 1}`;
                            }
                        });

                        domains = domains.concat(linkDomains);
                        return domains;
                    }, [])
                    .filter((domain, index, allDomains) => allDomains.indexOf(domain) === index);

                domains.sort();
                return domains;
            },

            editLink(domain, item) {
                this.editedItem = clone(item);
                this.editedLinkIndex = this.editedItem.links.findIndex(item => item.name === domain);
                this.editedLink = this.editedLinkIndex !== -1
                    ? clone(this.editedItem.links[this.editedLinkIndex])
                    : {};
                this.linkDialog = true;
            },
            closeLink() {
                this.linkDialog = false;
                this.editedItem = null;
                this.editedLink = null;
                this.editedLinkIndex = null;
            },
            async deleteLink() {
                if (this.editedItem !== null) {
                    if (this.editedLinkIndex !== -1) {
                        this.editedItem.links.splice(this.editedLinkIndex, 1);
                        await this.$store.dispatch('parse/saveItem', this.editedItem);
                    }
                }

                this.closeLink();
                return this.loadItems();
            },
            async saveLink() {
                if (this.editedItem !== null) {
                    if (this.editedLinkIndex !== -1) {
                        this.editedItem.links[this.editedLinkIndex] = this.editedLink;
                    }
                    else {
                        this.editedItem.links.push(this.editedLink);
                    }
                    await this.$store.dispatch('parse/saveItem', this.editedItem);
                }

                this.closeLink();
                return this.loadItems();
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
            domains() {
                let items = this.$store.state.parse.list;
                return this.getAllLinkDomains(items);
            },
            items() {
                if (this.loading) {
                    return [];
                }

                let items = this.$store.state.parse.list;
                let domains = this.domains;

                return items.map(item => {
                    let domainPrices = item.lastParsed && item.lastParsed.products
                        ? item.lastParsed.products.reduce((prices, product) => {
                            if (product.linkName) {
                                prices[product.linkName] = product.price;
                            }
                            else {
                                prices[product.host] = product.price;
                            }
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