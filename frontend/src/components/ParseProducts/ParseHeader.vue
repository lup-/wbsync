<template>
    <div>
        <v-btn color="primary" small @click="parseAll" :loading="parseActive">Обновить цены</v-btn>
    </div>
</template>

<script>
import moment from "moment";
import axios from "axios";

export default {
    data() {
        return {
            parseActive: false,
        }
    },
    methods: {
        async parseAll() {
            this.parseActive = true;
            await this.$store.dispatch('job/parseAll');
            this.parseActive = false;
        }
    }
}
</script>