<template>
    <v-form>
        <v-row dense class="mb-4">
            <v-col cols="12">
                <v-text-field v-model="item.title" label="Название типа товаров"></v-text-field>
            </v-col>
            <v-col cols="12">
                <v-btn @click="addDefaultFields" class="mr-4">Добавить стандартные поля</v-btn>
                <v-btn @click="addNewField">Добавить новое поле</v-btn>
            </v-col>
        </v-row>
        <v-card v-for="(field, index) in fields" :key="index"
                class="mb-4"
        >
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" md="4"><v-text-field v-model="field.title" label="Название"></v-text-field></v-col>
                    <v-col cols="12" md="4"><v-text-field v-model="field.code" label="Код"></v-text-field></v-col>
                    <v-col cols="12" md="4"><v-select v-model="field.type" :items="types" label="Тип"></v-select></v-col>
                </v-row>
                <v-row dense>
                    <v-col cols="12" md="6">
                        <v-checkbox v-model="field.multiple"
                                    label="Множественное"
                                    hide-details
                                    dense
                        ></v-checkbox>
                        <v-checkbox v-model="field.forVariant"
                                    label="Поле варианта"
                                    hide-details
                                    dense
                        ></v-checkbox>
                    </v-col>
                    <v-col cols="12" md="6" v-if="field.type === 'list'">
                        <v-combobox
                            v-model="field.values"
                            chips
                            deletable-chips
                            multiple
                            label="Значения"
                        ></v-combobox>
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>
    </v-form>
</template>

<script>
import clone from "lodash.clonedeep";

export default {
    props: ['value'],
    data() {
        return {
            item: this.value || {},
            defaultItem: {},
            defaultField: {title: '', type: '', code: '', multiple: false, values: [], forVariant: false},
            types: [
                {text: 'Штрихкод', value: 'barcode'},
                {text: 'Артикул', value: 'sku'},
                {text: 'Цена', value: 'price'},
                {text: 'Количество', value: 'quantity'},
                {text: 'Строка', value: 'string'},
                {text: 'Текст', value: 'text'},
                {text: 'Число', value: 'number'},
                {text: 'Список', value: 'list'},
            ],
            defaultFields: [
                {title: 'Название', code: 'title', type: 'string', multiple: false, values: [], forVariant: false},
                {title: 'Код', code: 'code', type: 'string', multiple: false, values: [], forVariant: false},
                {title: 'Описание', code: 'description', type: 'text', multiple: false, values: [], forVariant: false},
                {title: 'Штрихкоды', code: 'barcode', type: 'barcode', multiple: true, values: [], forVariant: true},
                {title: 'Артикулы', code: 'sku', type: 'sku', multiple: true, values: [], forVariant: true},
                {title: 'Цена', code: 'price', type: 'price', multiple: false, values: [], forVariant: true},
                {title: 'Количество', code: 'quantity', type: 'quantity', multiple: false, values: [], forVariant: true},
            ],
            fields: this.value.fields || [],
        }
    },
    watch: {
        value: {
            deep: true,
            handler() {
                this.item = this.value;
                this.fields = this.value.fields || [];
            }
        },
        item: {
            deep: true,
            handler() {
                this.emitItem();
            }
        },
        fields: {
            deep: true,
            handler() {
                this.emitItem();
            }
        }
    },
    methods: {
        addDefaultFields() {
            this.fields = this.fields.concat(this.defaultFields);
        },
        addNewField() {
            this.fields.push(clone(this.defaultField));
        },
        emitItem() {
            this.item.fields = this.fields;
            this.$emit('input', this.item);
        }
    },
    computed: {
    }
}
</script>

<style scoped>

</style>