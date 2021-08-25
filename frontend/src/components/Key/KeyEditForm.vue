<template>
    <v-form>
        <v-row dense>
            <v-col cols="12">
                <v-text-field v-model="item.title" label="Название продавца"></v-text-field>
                <v-select v-model="item.type" :items="types" label="Тип ключа"></v-select>
                <div v-if="item.type === 'wildberries'">
                    <v-textarea v-model="item.wb_64bit" label="Ключ для работы с API статистики x64"></v-textarea>
                    <v-textarea v-model="item.wb_new" label="Доступ к новому API"></v-textarea>
                </div>
                <div v-if="item.type === 'insales'">
                    <v-text-field v-model="item.insales_api_id" label="Идентификатор"></v-text-field>
                    <v-text-field v-model="item.insales_api_password" label="Пароль"></v-text-field>
                </div>
            </v-col>
        </v-row>
    </v-form>
</template>

<script>
export default {
    props: ['value'],
    data() {
        return {
            item: this.value || {},
            types: [
                {text: 'Wildberries', value: 'wildberries'},
                {text: 'InSales', value: 'insales'}
            ],
            defaultItem: {}
        }
    },
    watch: {
        value: {
            deep: true,
            handler() {
                this.item = this.value;
            }
        },
        item: {
            deep: true,
            handler() {
                this.$emit('input', this.item);
            }
        }
    },
    methods: {
    },
    computed: {
    }
}
</script>

<style scoped>

</style>