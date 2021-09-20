<template>
    <v-select
        v-model="activeFields"
        :items="fields"
        item-value="id"
        chips
        deletable-chips
        :label="label"
        :menu-props="menuProps"
        multiple
        clearable
        hide-details
        ref="selectComponent"
        :outlined="outlined"
        append-icon="mdi-content-save"
        @click:append="$emit('save')"
    >
        <template v-slot:selection="{item}">
            <v-chip close @click:close="deselectField(item.id)">
                {{ item.text }}: {{textValues(item.id)}}
            </v-chip>
        </template>
        <template v-slot:item="{ active, item, attrs, on }">
            <v-list-item v-on="on" v-bind="attrs" #default="{ active }" dense>
                <v-list-item-action>
                    <v-checkbox :input-value="active"></v-checkbox>
                </v-list-item-action>
                <v-list-item-content>
                    <v-row no-gutters align="center">
                        <v-col cols="6">
                            <v-list-item-title>{{ item.text }}</v-list-item-title>
                        </v-col>
                        <v-col cols="6">
                            <v-select v-if="item.type === 'select'"
                                v-model="values[item.id]"
                                :items="item.items"
                                v-bind="item.attrs"
                                outlined
                                hide-details
                                :clearable="!item.single"
                                :chips="!item.single"
                                :deletable-chips="!item.single"
                                dense
                                background-color="white"
                                :multiple="!item.single"
                                @input="updateActive(item.id)"
                                @click.stop="noopFunction"
                                @mousedown.stop="noopFunction"
                            ></v-select>
                            <v-switch v-else-if="item.type === 'dateFlag' || item.type === 'flag'"
                                v-model="values[item.id]"
                                hide-details
                                dense
                                class="my-auto"
                                @change="updateActive(item.id)"
                                @click.stop="noopFunction"
                                @mousedown.stop="noopFunction"
                            ></v-switch>
                            <date-field v-else-if="item.type === 'date'"
                                v-model="values[item.id]"
                                :as-unix="true"
                                class="my-auto"
                                @change="updateActive(item.id)"
                                @silent="updateActive(item.id, true)"
                                @click.stop="noopFunction"
                                @mousedown.stop="noopFunction"
                            ></date-field>
                            <v-text-field v-else
                                v-model="values[item.id]"
                                full-width
                                dense
                                outlined
                                hide-details
                                clearable
                                background-color="white"
                                @input="updateActive(item.id)"
                                @click.stop="noopFunction"
                                @mousedown.stop="noopFunction"
                            ></v-text-field>
                        </v-col>
                    </v-row>
                </v-list-item-content>
            </v-list-item>
        </template>
        <template v-slot:append-item>
            <div class="fixed-footer">
                <v-divider class="mb-2"></v-divider>
                <v-list-item dense>
                    <v-list-item-content class="pa-0">
                        <v-row dense>
                            <v-col cols="12" class="d-flex justify-end align-center">
                                <v-btn small outlined color="secondary" class="mr-2" @click="clearFilter">Очистить</v-btn>
                                <v-btn color="primary" @click="closeMenu">Закрыть</v-btn>
                            </v-col>
                        </v-row>
                    </v-list-item-content>
                </v-list-item>
            </div>
        </template>
    </v-select>
</template>

<script>
import moment from "moment";
import clone from "lodash.clonedeep"
import DateField from "@/components/Filter/DateField";

export default {
    props: ['fields', 'value', 'label', 'outlined'],
    components: {DateField},
    data() {
        return {
            console: console,
            activeFields: Object.keys(this.value),
            values: clone(this.value),
            selectMenuActive: null,
            menuProps: {offsetY: true, maxHeight: 500}
        }
    },
    watch: {
        activeFields: {
            deep: true,
            handler() {
                return this.emitFilter();
            }
        },
        values: {
            deep: true,
            handler() {
                return this.emitFilter();
            }
        },
        selectMenuActive() {
            if (this.selectMenuActive !== null) {
                setTimeout(() => {
                    this.selectMenuActive = null;
                }, 300);
            }
        }
    },
    methods: {
        noopFunction() {
            return null;
        },
        emitFilter() {
            let filter = this.activeFields.reduce((buildFilter, fieldId) => {
                let fieldParams = this.fields.find(field => field.id === fieldId);
                let isNumber = fieldParams && fieldParams.type && fieldParams.type === 'number';

                buildFilter[fieldId] = isNumber
                    ? parseInt(this.values[fieldId])
                    : this.values[fieldId];

                return buildFilter;
            }, {});

            this.$emit('input', filter);
        },
        textValues(fieldId) {
            let fieldParams = this.fields.find(field => field.id === fieldId);
            let value = this.values[fieldId];
            if (value instanceof Array) {
                let textValues = fieldParams.items
                    .filter(item => value.indexOf(item.value) !== -1)
                    .map(item => item.text);

                return textValues.join(', ');
            }
            else if (fieldParams.type === 'dateFlag' || fieldParams.type === 'flag') {
                return value ? 'Да' : 'Нет';
            }
            else if (fieldParams.type === 'select') {
                let valueItem = fieldParams.items.find(item => item.value === value);
                return valueItem ? valueItem.text : value;
            }
            else if (fieldParams.type === 'date') {
                return moment.unix(value).format('DD.MM.YYYY');
            }
            return value;
        },
        deselectField(fieldId) {
            let fieldIndex = this.activeFields.indexOf(fieldId);
            if (fieldIndex !== -1) {
                this.activeFields.splice(fieldIndex, 1);
            }
        },
        selectField(fieldId) {
            this.activeFields.push(fieldId);
        },
        updateActive(fieldId, silent = false) {
            let fieldProps = this.fields.find(field => field.id === fieldId);
            let value = this.values[fieldId];
            let oldActive = this.activeFields.indexOf(fieldId) !== -1;
            let newActive = value instanceof Array
                ? value.length > 0
                : Boolean(value);
            let isBooleanField = fieldProps && fieldProps.type === 'dateFlag';

            if (oldActive !== newActive && !silent) {
                if (newActive === true) {
                    this.selectField(fieldId);
                }
                else {
                    if (!isBooleanField) {
                        this.deselectField(fieldId);
                    }
                }
            }
        },
        closeMenu() {
            this.$refs.selectComponent.isMenuActive = false;
        },
        clearFilter() {
            this.activeFields = [];
            this.closeMenu();
        }
    },

}
</script>

<style scoped>
    .fixed-footer {
        position:sticky;
        bottom: 8px;
        width: 100%;
        display: flex;
        flex-direction: column;
        background: white;
    }
</style>