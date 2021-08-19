<template>
    <v-form>
        <v-row dense>
            <v-col cols="12">
                <v-text-field v-model="item.title" label="Название ключа"></v-text-field>
                <v-textarea v-model="item.wb_64bit" label="Ключ для работы с API статистики x64"></v-textarea>
                <v-textarea v-model="item.wb_new" label="Доступ к новому API"></v-textarea>
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