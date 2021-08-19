<template>
    <v-dialog v-model="showDialog" width="700">
        <template v-slot:activator="args">
            <slot name="activator" v-bind="args"></slot>
        </template>
        <v-card>
            <v-card-title>Товары в заказе {{orderId}}</v-card-title>
            <v-card-text>
                <v-data-table
                    dense
                    :headers="headers"
                    :items="products"
                    :items-per-page="15"
                    item-key="barcode"
                    disable-pagination
                    disable-filtering
                    disable-sort
                    hide-default-footer
                    locale="ru"
                >
                    <template v-slot:item.size="{ item }">
                        {{[item.size.ru, item.size.de].filter(size => Boolean(size)).join('/')}}
                    </template>
                </v-data-table>
            </v-card-text>
            <v-divider></v-divider>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="primary" @click="close">Закрыть</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
export default {
    props: ['value', 'products', 'orderId'],
    data() {
        return {
            showDialog: this.value,
            headers: [
                {text: 'Артикул', value: 'sku'},
                {text: 'Цвет', value: 'color'},
                {text: 'Размер', value: 'size'},
                {text: 'Название', value: 'title'},
                {text: 'Штрих-код', value: 'barcode'},
                {text: 'Количество', value: 'quantity'},
            ]
        }
    },
    watch: {
        value() {
            if (this.showDialog !== this.value) {
                this.showDialog = this.value;
            }
        },
        showDialog() {
            if (this.showDialog !== this.value) {
                this.$emit('input', this.showDialog);
            }
        }
    },
    methods: {
        async close() {
            this.$emit('close');
            this.showDialog = false;
        },
    }
}
</script>

<style scoped>
</style>