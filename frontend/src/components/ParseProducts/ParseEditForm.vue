<template>
    <v-form>
        <v-row dense class="mb-4">
            <v-col cols="12">
                <v-text-field v-model="item.title" label="Название товара"></v-text-field>
                <v-text-field v-model.number="item.period" label="Через сколько часов обновлять данные"></v-text-field>
            </v-col>
            <v-col cols="12">
                <v-btn @click="addNewLink">Добавить ссылку</v-btn>
                <div v-for="(link, index) in links" :key="index">
                    <v-text-field v-model="links[index]" :label="`Ссылка #${index+1}`"></v-text-field>
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
            defaultItem: {},
            links: this.value ? this.value.links || [] : [],
        }
    },
    watch: {
        value: {
            deep: true,
            handler() {
                this.item = this.value;
                this.links = this.value.links || [];
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
        addNewLink() {
            this.links.push('');
        },
        emitItem() {
            this.item.links = this.links;
            if (!this.item.period) {
                this.item.period = 24;
            }
            this.$emit('input', this.item);
        }
    },
    computed: {
    }
}
</script>

<style scoped>

</style>