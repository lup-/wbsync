<template>
    <v-container class="align-start">
        <v-row>
            <v-col cols="12">
                <v-text-field v-model="title" label="Название типа поставки"></v-text-field>
                <v-select v-model="productTypeId" :items="productTypes" label="Тип товаров"></v-select>
                <v-select v-model="separator" :items="separators" label="Разделитель"></v-select>
                <v-select v-model="codepage" :items="codepages" label="Кодировка"></v-select>
                <v-text-field v-model.number="skipCsvLines" label="Пропустить строки"></v-text-field>
                <v-checkbox v-model="hasHeader" label="В первой строке заголовок"></v-checkbox>
                <p class="mt-4">Чтобы задать сопоставление полей, загрузите файл в формате CSV. Файл должен содержать данные со свойствами товаров</p>
                <v-file-input
                    v-model="file"
                    label="Новый файл"
                    hint="В формате CSV"
                    persistent-hint
                    outlined
                    @change="readFile"
                ></v-file-input>
            </v-col>
        </v-row>

        <v-row v-if="items" class="align-center">
            <v-col cols="12">
                <v-card-title>Загруженные данные</v-card-title>
            </v-col>
        </v-row>
        <v-row v-if="items">
            <v-col cols="12">
                <v-data-table
                    dense
                    disable-sort
                    :headers="headers"
                    :items="items"
                >
                    <template v-slot:[header.slot] v-for="(header, index) in headers">
                        <div :key="header.value">
                            <span>{{header.text}}</span>
                            <v-select v-model="dataMap[index]"
                                      label="Поле карточки"
                                      :items="fields"
                                      dense
                                      single-line
                            ></v-select>
                        </div>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>

    </v-container>
</template>

<script>
import iconv from "iconv-lite";
import clone from "lodash.clonedeep";
import {Buffer} from "buffer";

export default {
    props: ['value'],
    data() {
        return {
            item: this.value || {},
            rawCsv: null,
            title: '',
            skipCsvLines: 0,
            hasHeader: true,
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
            dataMap: {},
            productTypeId: null,
        }
    },
    watch: {
        dataMap: {
            deep: true,
            handler() {
                this.emitInput();
            }
        },
        title() {
            this.emitInput();
        },
        skipCsvLines() {
            this.emitInput();
        },
        hasHeader() {
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
    },
    async created() {
        this.initItem();
        this.loadProductTypes();
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

            if (this.item.skipCsvLines) {
                this.skipCsvLines = this.item.skipCsvLines;
            }

            if (this.item.hasHeader) {
                this.hasHeader = this.item.hasHeader;
            }

            if (this.item.separator) {
                this.separator = this.item.separator;
            }

            if (this.item.codepage) {
                this.codepage = this.item.codepage;
            }

            if (this.item.dataMap) {
                this.dataMap = clone(this.item.dataMap);
            }
        },
        loadProductTypes() {
            return this.$store.dispatch('productType/loadItems');
        },
        emitInput() {
            let dataMapWithoutNull = Object.keys(this.dataMap).reduce((result, key) => {
                let value = this.dataMap[key];
                if (value) {
                    result[key] = value;
                }

                return result;
            }, {});

            this.$emit('input', Object.assign(this.item, {
                productTypeId: this.productTypeId,
                title: this.title,
                skipCsvLines: this.skipCsvLines,
                hasHeader: this.hasHeader,
                separator: this.separator,
                codepage: this.codepage,
                dataMap: dataMapWithoutNull,
            }));
        },
        async loadToBrowser(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsArrayBuffer(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        },
        arrayBufferToString( buffer ) {
            let binary = '';
            let bytes = new Uint8Array( buffer );
            let len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode( bytes[ i ] );
            }

            return binary;
        },
        parseCsvFile(text, separator = ',') {
            //https://stackoverflow.com/a/41563966
            let prevChar = '';
            let row = [''];
            let result = [row];
            let cellIndex = 0;
            let rowIndex = 0;
            let isSeparatorOpen = true;
            let char = null;

            for (char of text) {
                if (char === '"') {
                    if (isSeparatorOpen && char === prevChar) {
                        row[cellIndex] += char;
                    }
                    isSeparatorOpen = !isSeparatorOpen;
                }
                else if (separator === char && isSeparatorOpen) {
                    ++cellIndex;
                    char = '';
                    row[cellIndex] = '';
                }
                else if (char === '\n' && isSeparatorOpen) {
                    if (prevChar === '\r') {
                        row[cellIndex] = row[cellIndex].slice(0, -1);
                    }

                    ++rowIndex;
                    char = '';
                    row = [''];
                    result[rowIndex] = row;
                    cellIndex = 0;
                }
                else {
                    row[cellIndex] += char;
                }
                prevChar = char;
            }
            return result;
        },

        async readFile(file) {
            if (!file) {
                this.rawCsv = null;
                return;
            }

            let buffer = await this.loadToBrowser(file);
            this.rawCsv = buffer;
        },
        getColumn(code) {
            return this.items.map(item => item[code]);
        }
    },
    computed: {
        csv() {
            let decodeBuffer = Buffer.from(this.rawCsv);
            let preparedCsv = iconv.decode(decodeBuffer, this.codepage);

            let parsedCsv = this.rawCsv ? this.parseCsvFile(preparedCsv, this.separator) : [];
            if (this.skipCsvLines > 0) {
                parsedCsv.splice(0, this.skipCsvLines);
            }

            return parsedCsv;
        },
        items() {
            let headers = this.titles;
            if (!headers || !this.rawCsv) {
                return false;
            }

            let itemsCsv = this.csv;
            if (this.hasHeader) {
                itemsCsv = itemsCsv.slice(1);
            }

            return itemsCsv
                .filter(row => {
                    let isEmpty = row.reduce((empty, value) => empty && !value, true);
                    return !isEmpty;
                })
                .map(values => {
                    return Object.fromEntries(headers.map((k, i) => [k, values[i]]));
                });
        },
        titles() {
            if (!this.rawCsv) {
                return false;
            }

            if (this.hasHeader) {
                return this.csv[0];
            }

            return this.csv[0].map((cell, index) => `Столбец ${index+1}`);
        },
        headers() {
            if (!this.rawCsv) {
                return false;
            }

            return this.titles.map(title => {
                return {
                    text: title,
                    value: title,
                    slot: 'header.'+title,
                    sort: false,
                }
            });
        },
        productTypes() {
            return this.$store.state.productType.list.map(productType => ({
                text: productType.title,
                value: productType.id,
            }));
        },
        selectedProductType() {
            if (!this.productTypeId) {
                return null;
            }

            return this.$store.getters['productType/byId'](this.productTypeId);
        },
        fields() {
            if (this.selectedProductType) {
                let productFields = this.selectedProductType.fields.map(field => ({text: field.title, value: field.code}));
                let baseFields = [
                    {text: 'Не выбрано', value: null}
                ];

                return baseFields.concat(productFields);
            }

            return [];
        }
    }
}
</script>

<style scoped lang="scss">
</style>