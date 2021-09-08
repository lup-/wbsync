<template>
    <v-container class="fill-height align-start">
        <v-row>
            <v-col cols="12" md="4" v-if="upload">
                <v-card>
                    <v-card-title>Отправка остатков</v-card-title>
                    <v-card-subtitle>Последняя: {{formatDate(upload.date)}}</v-card-subtitle>
                    <v-card-actions>
                        <v-btn color="primary" @click="$router.push({name: 'compareList'})">Выбрать позиции</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
            <v-col cols="12" md="4" v-if="download">
                <v-card>
                    <v-card-title>Обновление остатков</v-card-title>
                    <v-card-subtitle>Последняя: {{formatDate(download.date)}}</v-card-subtitle>
                    <v-card-actions>
                        <v-btn color="primary" @click="downloadStocks" :loading="downloadActive">Обновить</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
            <v-col cols="12" md="4" v-if="sync">
                <v-card>
                    <v-card-title>Обновление заказов</v-card-title>
                    <v-card-subtitle>Последняя: {{formatDate(sync.date)}}</v-card-subtitle>
                    <v-card-actions>
                        <v-btn color="primary" @click="syncOrders" :loading="syncActive">Обновить</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    import moment from "moment";
    import axios from "axios";

    export default {
        data() {
            return {
                upload: false,
                download: false,
                sync: false,
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
                this.download = data.download || false;
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
            }
        }
    }
</script>