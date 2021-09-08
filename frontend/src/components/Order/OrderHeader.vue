<template>
    <div>
        <span class="text--secondary mr-6">Обновление заказов: {{sync.date ? formatDate(sync.date) : '...'}}</span>
        <v-btn color="primary" small @click="syncOrders" :loading="syncActive">Обновить</v-btn>
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