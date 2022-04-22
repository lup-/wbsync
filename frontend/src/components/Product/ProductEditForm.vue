<template>
    <v-form>
        <v-row dense>
            <v-col cols="12">
                <div v-for="field in fields" :key="field.code">
                    <v-combobox v-model="item.props[field.code]" v-if="['barcode', 'sku', 'string', 'title'].includes(field.type) && field.multiple"
                                class="mb-4"
                                :label="field.title"
                                clearable
                                multiple
                                chips
                                deletable-chips
                                hint="Множественное поле. Для добавления значения в список надо нажать Enter"
                                persistent-hint
                    ></v-combobox>
                    <v-text-field v-model="item.props[field.code]" v-else-if="['barcode', 'sku', 'string', 'title'].includes(field.type)"
                                class="mb-4"
                                :label="field.title"
                                clearable
                    ></v-text-field>
                    <v-text-field v-model="item.props[field.code]" v-else-if="['price', 'quantity', 'number'].includes(field.type)"
                                class="mb-4"
                                type="number"
                                :label="field.title"
                                clearable
                    ></v-text-field>
                    <v-textarea v-model="item.props[field.code]" v-else
                                class="mb-4"
                                :label="field.title"
                    ></v-textarea>

                </div>
            </v-col>
        </v-row>
    </v-form>
</template>

<script>
export default {
    props: ['value', 'productTypes'],
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
        productType() {
            if (!this.value || !this.productTypes) {
                return null;
            }

            return this.productTypes.find(type => type.id === this.value.productTypeId);
        },
        fields() {
            return this.productType ? this.productType.fields || [] : [];
        }
    }
}
</script>

<style scoped>

</style>