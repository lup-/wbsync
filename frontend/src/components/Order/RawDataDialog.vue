<template>
    <v-dialog v-model="showDialog" width="700">
        <template v-slot:activator="args">
            <slot name="activator" v-bind="args"></slot>
        </template>
        <v-card class="dialog_raw">
            <v-card-title>Исходные данные</v-card-title>
            <v-card-text>
                <v-treeview
                    open-on-click
                    dense
                    :items="items"
                ></v-treeview>
            </v-card-text>
            <v-divider></v-divider>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="primary" @click="close">Закрыть</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
export default {
    props: ['value', 'raw', 'orderId'],
    data() {
        return {
            showDialog: this.value,
        }
    },
    watch: {
        value() {
            if (this.showDialog !== this.value) {
                this.showDialog = this.value;
            }
        },
        showDialog() {
            if (this.showDialog !== this.value) {
                this.$emit('input', this.showDialog);
            }
        }
    },
    methods: {
        async close() {
            this.$emit('close');
            this.showDialog = false;
        },
        keysToTreeItems(object) {
            let tree = [];
            for (let key of Object.keys(object)) {
                let value = object[key];
                let item = {
                    id: key,
                    name: key
                }

                if (value instanceof Array) {
                    if (value.length > 0) {
                        let children = value.map((item, index) => {
                            if (typeof (item) === 'object') {
                                return {
                                    id: `${key}:${index}`,
                                    name: `${key}[${index}]`,
                                    children: this.keysToTreeItems(item),
                                }
                            }
                            else {
                                return {
                                    id: `${key}[${index}]`,
                                    name: item,
                                }
                            }
                        });

                        item.children = children;
                    }
                    else {
                        item.name = `${key}: []`;
                    }
                }
                else if (value === null) {
                    item.name = `${key}: null`
                }
                else if (typeof (value) === 'object') {
                    item.children = this.keysToTreeItems(value);
                }
                else {
                    let textValue = typeof (value) === 'number' ? value : `"${value}"`;
                    item.name = `${key}: ${textValue}`
                }

                tree.push(item);
            }

            return tree;
        },
    },
    computed: {
        items() {
            return this.raw ? this.keysToTreeItems(this.raw) : [];
        }
    }
}
</script>

<style lang="scss">
    .dialog_raw {
        .v-card__text {
            height: 430px;
            overflow-y: scroll;
            font-family: monospace;
            font-size: 10px;

            .v-treeview--dense {
                .v-treeview-node {
                    &__root {
                        min-height: 20px;
                    }

                    &__toggle {
                        width: 12px;
                        height: 12px;
                        font-size: 16px!important;
                    }

                    &__level {
                        width: 12px;
                    }
                }
            }
        }
    }
</style>