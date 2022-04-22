<template>
    <v-menu
            v-model="menuDate"
            :close-on-content-click="false"
            transition="scale-transition"
            offset-y
            max-width="290px"
            min-width="290px"
    >
        <template v-slot:activator="{ on, attrs }">
            <v-text-field
                    v-model="dateFormatted"
                    :label="label"
                    hint="В формате 31.12.2020"
                    persistent-hint
                    clearable
                    prepend-icon="mdi-calendar"
                    v-bind="attrs"
                    @blur="updateDateFromText"
                    v-on="on"
            ></v-text-field>
        </template>
        <v-date-picker
                v-model="date"
                no-title
                @input="menuDate = false"
        ></v-date-picker>
    </v-menu>
</template>

<script>
    import moment from "moment";

    export default {
        props: ['value', 'label', 'dayStart', 'dayEnd'],
        data() {
            let date = moment.unix(this.value);
            if (!date.isValid()) {
                date = null;
            }

            return {
                menuDate: false,
                date: date ? date.format('YYYY-MM-DD') : '',
                dateFormatted: date ? date.format('DD.MM.YYYY') : '',
            }
        },
        watch: {
            date () {
                this.dateFormatted = this.formatDate(this.date);
                this.commitChange();
            },
        },
        methods: {
            updateDateFromText() {
                this.date = this.parseDate(this.dateFormatted);
                this.commitChange();
            },
            parseDate (date) {
                if (!date) return null

                const [day, month, year] = date.split('.')
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            },
            formatDate (date) {
                if (!date) return null

                const [year, month, day] = date.split('-')
                return `${day}.${month}.${year}`
            },
            commitChange() {
                let value = moment(this.date, 'YYYY-MM-DD');
                if (this.dayStart) {
                    value = value.startOf('d');
                }

                if (this.dayEnd) {
                    value = value.endOf('d');
                }

                this.$emit('input', value.unix());
            }
        }
    }
</script>

<style scoped>

</style>