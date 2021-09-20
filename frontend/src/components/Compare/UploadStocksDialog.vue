<template>
    <v-dialog v-model="showDialog" width="700">
        <template v-slot:activator="args">
            <slot name="activator" v-bind="args"></slot>
        </template>
        <v-card>
            <v-card-title>Отправка остатков</v-card-title>
            <v-card-text>
                <v-select
                    v-model="fields.from"
                    :items="fromSources"
                    label="Откуда"
                    hint="Откуда брать остатки"
                    persistent-hint
                    return-object
                    class="mb-4"
                ></v-select>
                <v-select
                    v-model="fields.to"
                    :items="toSources"
                    label="Куда"
                    hint="Куда загружать остатки"
                    persistent-hint
                    return-object
                ></v-select>
            </v-card-text>
            <v-divider></v-divider>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="secondary" outlined small @click="close">Закрыть</v-btn>
                <v-btn color="primary" @click="ok">Отправить</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
export default {
    props: ['value', 'show'],
    data() {
        return {
            showDialog: this.show,
            fields: {},
        }
    },
    watch: {
        show() {
            if (this.showDialog !== this.show) {
                this.showDialog = this.show;
            }
        },
        showDialog() {
            if (this.showDialog !== this.show) {
                this.$emit('show', this.showDialog);
            }
        },
        fields: {
            deep: true,
            handler() {
                this.$emit('input', this.fields);
            }
        }
    },
    mounted() {
        this.loadKeys();
    },
    methods: {
        close() {
            this.showDialog = false;
            this.$emit('close');
        },
        ok() {
            this.showDialog = false;
            this.$emit('ok', this.fields);
        },
        async loadKeys() {
            this.loading = true;
            await this.$store.dispatch('key/loadItems');
            this.loading = false;
        },
    },
    computed: {
        keys() {
            return this.$store.state.key.list;
        },
        toSources() {
            return this.keys
                .map(key => {
                    return {
                        text: key.title,
                        source: key.type,
                        keyId: key.id
                    }
                });
        },
        fromSources() {
            return [
                {text: '1С', source: '1c', keyId: null},
            ]
        }
    }
}
</script>

<style scoped>
</style>