<template>
    <v-dialog
        v-model="showDialog"
        max-width="600px"
    >
        <v-card>
            <v-card-title>
                Импорт поставки {{supply ? supply.title : ''}}
                <v-spacer></v-spacer>
                <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
            </v-card-title>
            <v-card-text>
                <v-select v-model="stockType" :items="stockTypes" label="Что делать с остатками из этой поставки?"></v-select>
                <v-checkbox v-model="joinSameBarcodes" label="Суммировать остатки одинаковых штрихкодов в поставке"></v-checkbox>
                <v-checkbox v-model="updateProps" label="Обновлять значения свойств существующих товаров"></v-checkbox>
            </v-card-text>
            <v-card-actions>
                <v-btn text @click="close">Отмена</v-btn>
                <v-spacer></v-spacer>
                <v-btn color="primary" large @click="accept">Принять поставку</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
export default {
    props: ['value', 'supply'],
    data() {
        return {
            showDialog: this.value,
            stockType: this.supply && this.supply.acceptOptions
                ? this.supply.acceptOptions.stockType
                : 'add',
            joinSameBarcodes: this.supply && this.supply.acceptOptions
                ? this.supply.acceptOptions.stockType
                : true,
            updateProps: this.supply && this.supply.acceptOptions
                ? this.supply.acceptOptions.stockType
                : false,
            stockTypes: [
                {text: 'Добавить к текущим остаткам', value: 'add'},
                {text: 'Установить точное значение', value: 'set'}
            ]
        }
    },
    watch: {
        value() {
            this.showDialog = this.value;
        },
        supply() {
            if (this.supply && this.supply.acceptOptions) {
                this.stockType = this.supply.acceptOptions.stockType;
                this.joinSameBarcodes = this.supply.acceptOptions.joinSameBarcodes;
                this.updateProps = this.supply.acceptOptions.updateProps;
            }
        }
    },
    methods: {
        close() {
            this.showDialog = false;
            this.$emit('input', this.showDialog);
            this.$emit('cancel');
        },
        accept() {
            this.showDialog = false;
            this.$emit('input', this.showDialog);

            let options = {
                stockType: this.stockType,
                updateProps: this.updateProps,
                joinSameBarcodes: this.joinSameBarcodes,
            }

            this.$emit('accept', this.supply, options);
        }
    }
}
</script>

<style scoped>

</style>