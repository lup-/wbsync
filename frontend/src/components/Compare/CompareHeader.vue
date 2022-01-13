<template>
    <div>
        <v-dialog v-model="showDialog" width="500">
            <template v-slot:activator="{ on, attrs }">
                <v-btn text v-bind="attrs" v-on="on">
                    <span class="text--secondary stock-text">Обновление остатков: {{download.date ? formatDate(download.date) : '...'}}</span>
                </v-btn>
            </template>
            <v-card>
                <v-card-title>Последняя загрузка остатков</v-card-title>
                <v-card-text>
                    <v-expansion-panels>
                        <v-expansion-panel v-for="download in downloadDetails" :key="download._id">
                            <v-expansion-panel-header>
                                <v-row>
                                    <v-col cols="12" md="6" class="d-flex flex-column">
                                        <span>{{sourceTitle(download.key ? download.key.id : null)}}</span>
                                        <span class="text--secondary">{{ typeTitle(download.from) }}</span>
                                    </v-col>
                                    <v-col cols="12" md="6" class="text--secondary">{{formatDate(download.date)}}</v-col>
                                </v-row>
                            </v-expansion-panel-header>
                            <v-expansion-panel-content>
                                <v-list-item v-if="download.from === '1c'">
                                    <v-list-item-content>
                                        <v-list-item-title>Дата создания файла</v-list-item-title>
                                        <v-list-item-subtitle>{{formatDate(download.stat.mtimeMs/1000)}}</v-list-item-subtitle>
                                    </v-list-item-content>
                                </v-list-item>

                                <v-list-item>
                                    <v-list-item-content>
                                        <v-list-item-title>Успешно</v-list-item-title>
                                        <v-list-item-subtitle>{{download.isSuccess ? 'Да' : 'Нет'}}</v-list-item-subtitle>
                                    </v-list-item-content>
                                </v-list-item>
                                <v-list-item>
                                    <v-list-item-content>
                                        <v-list-item-title>Новых товаров</v-list-item-title>
                                        <v-list-item-subtitle>{{download.newItems}}</v-list-item-subtitle>
                                    </v-list-item-content>
                                </v-list-item>
                                <v-list-item>
                                    <v-list-item-content>
                                        <v-list-item-title>Обновлено</v-list-item-title>
                                        <v-list-item-subtitle>{{download.updatedItems}}</v-list-item-subtitle>
                                    </v-list-item-content>
                                </v-list-item>
                                <v-list-item>
                                    <v-list-item-content>
                                        <v-list-item-title>Обработано</v-list-item-title>
                                        <v-list-item-subtitle>{{download.count}}</v-list-item-subtitle>
                                    </v-list-item-content>
                                </v-list-item>
                            </v-expansion-panel-content>
                        </v-expansion-panel>
                    </v-expansion-panels>
                </v-card-text>
                <v-divider></v-divider>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="showDialog = false">Закрыть</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <v-btn color="primary" small @click="downloadStocks" :loading="downloadActive" class="ml-4">Обновить</v-btn>
    </div>
</template>

<script>
import moment from "moment";
import axios from "axios";

export default {
    data() {
        return {
            upload: false,
            download: false,
            downloadDetails: false,
            sync: false,
            showDialog: false,
            downloadActive: false,
            syncActive: false,
        }
    },
    created() {
        this.loadLogs();
    },
    methods: {
        formatDate(date) {
            return moment.unix(date).format('DD.MM.YYYY, HH:mm')
        },
        async loadLogs() {
            let {data} = await axios.get('/api/job/last');
            this.upload = data.upload || false;
            this.download = data.downloadAll || false;
            this.downloadDetails = data.download || false;
            this.sync = data.sync || false;
        },
        async downloadStocks() {
            this.downloadActive = true;
            await this.$store.dispatch('job/downloadStocks');
            await this.loadLogs();
            this.downloadActive = false;
        },
        async syncOrders() {
            this.syncActive = true;
            await this.$store.dispatch('job/syncOrders');
            await this.loadLogs();
            this.syncActive = false;
        },
        typeTitle(searchType) {
            return this.$store.getters['key/typeTitle'](searchType);
        },
        sourceTitle(searchValue) {
            return this.$store.getters['key/sourceTitle'](searchValue);
        }
    }
}
</script>
<style>
    .v-btn .v-btn__content .stock-text {
        text-transform: none;
        letter-spacing: 0;
        font-weight: normal;
        font-size: medium;
    }
</style>