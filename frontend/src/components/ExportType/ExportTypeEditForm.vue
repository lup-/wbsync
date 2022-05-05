<template>
    <v-container class="align-start">
        <v-row>
            <v-col cols="12">
                <v-text-field v-model="title" label="Название типа экспорта"></v-text-field>
                <v-select v-model="productTypeId"
                          :items="productTypes"
                          label="Тип товаров"
                          clearable
                          hint="Если пусто, то будут выгружены все типы товаров"
                          persistent-hint
                          class="mb-4"
                ></v-select>
                <v-select v-model="supplyTypeId"
                          :items="supplyTypes"
                          clearable
                          label="Тип загрузки для дополнительных полей"
                          hint="Если пусто, то можно использовать любой тип поставки"
                          persistent-hint
                          class="mb-4"
                ></v-select>
                <v-select v-model="separator" :items="separators" label="Разделитель"></v-select>
                <v-select v-model="codepage" :items="codepages" label="Кодировка"></v-select>
                <v-checkbox v-model="addHeader" label="Добавить заголовок"></v-checkbox>
                <v-select v-model="fields"
                          :items="availableFields"
                          label="Поля для экспорта"
                          hint="Если пусто, то будут выгружены все доступные поля"
                          persistent-hint
                          multiple
                          chips
                          deletable-chips
                >
                    <template v-slot:selection="{ item, index }">
                        <v-chip
                            close
                            @click:close="fields.splice(index, 1)"
                        >{{ item.text + (takeFromSupply[item.value] ? ' (из загрузки)' : '') }}</v-chip>
                    </template>
                    <template v-slot:item="{ active, item, attrs, on }">
                        <v-list-item v-bind="attrs" #default="{ active }">
                            <v-list-item-action>
                                <v-checkbox :input-value="active" v-on="on"></v-checkbox>
                            </v-list-item-action>
                            <v-list-item-content>
                                <v-list-item-title>
                                    <v-row no-gutters align="center">
                                        <v-col v-on="on">
                                            {{ item.text }}
                                        </v-col>
                                        <v-col>
                                            <v-checkbox v-if="isFieldInSupplyType(item.value)"
                                                        v-model="takeFromSupply[item.value]"
                                                        class="ma-0"
                                                        hide-details
                                                        label="Брать из загрузки"
                                            ></v-checkbox>
                                        </v-col>
                                    </v-row>
                                </v-list-item-title>
                            </v-list-item-content>
                        </v-list-item>
                    </template>
                </v-select>
            </v-col>
        </v-row>

    </v-container>
</template>

<script>
export default {
    props: ['value'],
    data() {
        return {
            item: this.value || {},
            title: '',
            addHeader: true,
            separator: ';',
            separators: [
                {text: 'Точка с запятой ";"', value: ';'},
                {text: 'Запятая ","', value: ','},
                {text: 'Табуляция', value: '\t'},
            ],
            codepage: 'utf8',
            codepages: [
                {text: 'UTF-8', value: 'utf8'},
                {text: 'WIN-1251', value: 'win1251'},
            ],
            file: null,
            productTypeId: null,
            supplyTypeId: null,
            fields: [],
            takeFromSupply: {},
        }
    },
    watch: {
        title() {
            this.emitInput();
        },
        addHeader() {
            this.emitInput();
        },
        separator() {
            this.emitInput();
        },
        codepage() {
            this.emitInput();
        },
        productTypeId() {
            this.emitInput();
        },
        supplyTypeId() {
            this.emitInput();
        },
        fields() {
            this.emitInput();
        }
    },
    async created() {
        this.initItem();
        this.loadProductTypes();
        this.loadSupplyTypes();
    },
    methods: {
        initItem() {
            this.item = this.value || {};
            if (this.item.title) {
                this.title = this.item.title;
            }

            if (this.item.productTypeId) {
                this.productTypeId = this.item.productTypeId;
            }

            if (this.item.supplyTypeId) {
                this.supplyTypeId = this.item.supplyTypeId;
            }

            if (this.item.addHeader) {
                this.addHeader = this.item.addHeader;
            }

            if (this.item.separator) {
                this.separator = this.item.separator;
            }

            if (this.item.codepage) {
                this.codepage = this.item.codepage;
            }

            if (this.item.fields) {
                this.fields = this.item.fields;
            }

            if (this.item.takeFromSupply) {
                let takeFromSupply = {};
                for (let fieldCode of this.item.takeFromSupply) {
                    takeFromSupply[fieldCode] = true;
                }
                this.takeFromSupply = takeFromSupply;
            }
        },
        loadProductTypes() {
            return this.$store.dispatch('productType/loadItems');
        },
        loadSupplyTypes() {
            return this.$store.dispatch('supplyType/loadItems');
        },
        isFieldInSupplyType(fieldCode) {
            if (!this.selectedSupplyType) {
                return false;
            }

            if (!this.selectedSupplyType.dataMap) {
                return false;
            }

            let dataMapFieldCodes = Object.values(this.selectedSupplyType.dataMap);
            return dataMapFieldCodes.includes(fieldCode);
        },
        emitInput() {
            let takeFromSupply = [];
            for (let fieldCode of Object.keys(this.takeFromSupply)) {
                if (this.takeFromSupply[fieldCode] === true) {
                    takeFromSupply.push(fieldCode);
                }
            }

            this.$emit('input', Object.assign(this.item, {
                productTypeId: this.productTypeId,
                supplyTypeId: this.supplyTypeId,
                title: this.title,
                addHeader: this.addHeader,
                separator: this.separator,
                codepage: this.codepage,
                fields: this.fields,
                takeFromSupply
            }));
        },
    },
    computed: {
        productTypes() {
            return this.$store.state.productType.list.map(productType => ({
                    text: productType.title,
                    value: productType.id,
                }));
        },
        supplyTypes() {
            let supplyTypes = this.$store.state.supplyType.list;
            if (this.selectedProductType) {
                supplyTypes = supplyTypes.filter(supplyType => supplyType.productTypeId === this.productTypeId);
            }

            return supplyTypes.map(supplyType => ({
                text: supplyType.title,
                value: supplyType.id,
            }));
        },
        selectedProductType() {
            if (!this.productTypeId) {
                return null;
            }

            return this.$store.getters['productType/byId'](this.productTypeId);
        },
        selectedSupplyType() {
            if (!this.supplyTypeId) {
                return null;
            }

            return this.$store.getters['supplyType/byId'](this.supplyTypeId);
        },
        availableFields() {
            let fields = [];

            if (this.selectedProductType) {
                let productFields = this.selectedProductType.fields.map(field => ({
                    text: field.title,
                    value: field.code
                }));
                return fields.concat(productFields);
            }


            return fields;
        }
    }
}
</script>

<style scoped lang="scss">
</style>