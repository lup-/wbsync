<template>
    <v-form>
        <v-row dense class="mb-4">
            <v-col cols="12">
                <v-text-field v-model="item.title" label="Название товара"></v-text-field>
                <v-text-field v-model.number="item.period" label="Через сколько часов обновлять данные"></v-text-field>
            </v-col>
            <v-col cols="12">
                <v-btn @click="addNewLink" class="mb-4">Добавить ссылку</v-btn>
                <div v-for="(link, index) in links" :key="link.name">
                    <parse-link-form v-model="links[index]" :index="index" @delete="deleteLink(index)"></parse-link-form>
                </div>
            </v-col>
        </v-row>
    </v-form>
</template>

<script>
import clone from "lodash.clonedeep";
import ParseLinkForm from "@/components/ParseProducts/ParseLinkForm";

export default {
    props: ['value'],
    components: {ParseLinkForm},
    data() {
        return {
            item: clone(this.value) || {},
            skipUpdateValue: false,
            defaultItem: {},
            links: this.value ? clone(this.value.links) || [] : [],
        }
    },
    watch: {
        value: {
            deep: true,
            handler() {
                if (this.skipUpdateValue) {
                    this.skipUpdateValue = false;
                }
                else {
                    this.item = clone(this.value);
                    this.links = clone(this.value.links) || [];
                }
            }
        },
        item: {
            deep: true,
            handler() {
                this.emitItem();
            }
        },
        links: {
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
            this.links.push({});
        },
        deleteLink(index) {
            this.links.splice(index, 1);
        },
        emitItem() {
            let item = clone(this.item);
            item.links = clone(this.links);
            if (!item.period) {
                item.period = 24;
            }

            this.skipUpdateValue = true;
            this.$emit('input', item);
        }
    },
    computed: {
    }
}
</script>

<style scoped>

</style>