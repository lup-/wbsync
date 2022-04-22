<template>
    <v-container class="align-start">
        <v-row>
            <v-col cols="12">
                <v-text-field v-model="title" label="Название поставки"></v-text-field>
                <v-select v-model="supplyTypeId" :items="supplyTypes" label="Шаблон загрузки"></v-select>
                <date-editor v-model="item.supplyDate" label="Дата поставки"></date-editor>
                <date-editor v-model="item.docDate" label="Дата документа"></date-editor>
                <v-text-field v-model="item.docNumber" label="Номер документа"></v-text-field>
                <v-file-input
                    v-model="file"
                    label="Файл с товарами в поставке"
                    hint="В формате CSV"
                    persistent-hint
                    outlined
                ></v-file-input>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import clone from "lodash.clonedeep";
import DateEditor from "@/components/DateEditor";

export default {
    props: ['value'],
    components: {DateEditor},
    data() {
        return {
            item: clone(this.value) || {},
            title: '',
            file: null,
            supplyTypeId: null,
        }
    },
    watch: {
        title() {
            this.emitInput();
        },
        file() {
            this.emitInput();
        },
        supplyTypeId() {
            this.emitInput();
        },
    },
    async created() {
        this.initItem();
        this.loadSupplyTypes();
    },
    methods: {
        initItem() {
            this.item = this.value || {};
            if (this.item.title) {
                this.title = this.item.title;
            }

            if (this.item.supplyTypeId) {
                this.supplyTypeId = this.item.supplyTypeId;
            }
        },
        loadSupplyTypes() {
            return this.$store.dispatch('supplyType/loadItems');
        },
        emitInput() {
            this.$emit('input', Object.assign(this.item, {
                supplyTypeId: this.supplyTypeId,
                title: this.title,
                file: this.file
            }));
        },
    },
    computed: {
        supplyTypes() {
            return this.$store.state.supplyType.list.map(supplyType => ({
                text: supplyType.title,
                value: supplyType.id,
            }));
        }
    }
}
</script>

<style scoped lang="scss">
</style>