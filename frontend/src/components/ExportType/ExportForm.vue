<template>
    <v-container class="align-start">
        <v-row>
            <v-col cols="12">
                <v-select v-model="supply"
                          :items="supplies"
                          label="Загрузка, из которой брать дополнительные поля"
                          item-text="title"
                          item-value="id"
                          return-object
                ></v-select>
                <v-checkbox v-if="supply" v-model="onlyInSupply" label="Выгружать только те товары, которые есть в загрузке"></v-checkbox>
            </v-col>
        </v-row>

    </v-container>
</template>

<script>
export default {
    props: ['value', 'exportType'],
    data() {
        return {
            item: this.value || {},
            supply: null,
            onlyInSupply: false,
        }
    },
    watch: {
        value() {
            this.item = this.value;
        },
        supply() {
            this.emitInput();
        },
        onlyInSupply() {
            this.emitInput();
        },
        supplyTypeId() {
            if (this.supplyTypeId) {
                this.loadSupplies();
            }
        }
    },
    async created() {
        this.loadSupplies();
    },
    methods: {
        loadSupplies() {
            let filter = {};
            if (this.supplyTypeId) {
                filter['supplyTypeId'] = this.supplyTypeId;
            }

            return this.$store.dispatch('supply/loadItems', {filter});
        },
        emitInput() {
            this.$emit('input', Object.assign(this.item, {
                supply: this.supply || null,
                onlyInSupply: this.onlyInSupply
            }));
        },
    },
    computed: {
        supplyTypeId() {
            return this.exportType && this.exportType.supplyTypeId ? this.exportType.supplyTypeId : null;
        },
        supplies() {
            return this.supplyTypeId && this.$store.state.supply.list
                ? this.$store.state.supply.list.filter(supply => supply.supplyTypeId === this.supplyTypeId)
                : this.$store.state.supply.list;
        },
    }
}
</script>

<style scoped lang="scss">
</style>