<template>
    <v-menu
        v-model="showMenuDate"
        :close-on-content-click="false"
        transition="scale-transition"
        offset-y
        max-width="290px"
        min-width="290px"
    >
        <template v-slot:activator="{ on, attrs }">
            <v-text-field
                v-model="formatted"
                hint="В формате 31.12.2020"
                persistent-hint
                prepend-icon="mdi-calendar"
                v-bind="attrs"
                @blur="date = parseDate(formatted)"
                v-on="on"
            ></v-text-field>
        </template>
        <v-date-picker
            v-model="date"
            no-title
            @input="showMenuDate = false"
        ></v-date-picker>
    </v-menu>
</template>

<script>
import moment from "moment";

export default {
    props: ['value', 'asUnix'],
    data() {
        let defaultDate = moment().subtract(1, 'd');
        let parsedDate = this.value
            ? moment(this.value, 'DD.MM.YYYY')
            : defaultDate;

        if (!(parsedDate && parsedDate.isValid())) {
            parsedDate = defaultDate;
        }

        return {
            showMenuDate: false,
            date: parsedDate.format('YYYY-MM-DD'),
            formatted: parsedDate.format('DD.MM.YYYY'),
        }
    },
    mounted() {
        this.updateDate(true);
    },
    watch: {
        date () {
            this.formatted = this.formatDate(this.date);
            this.updateDate();
        },
    },
    methods: {
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
        updateDate(silent = false) {
            let date = this.date
                ? moment( this.date ).startOf('d')
                : moment().startOf('d');

            let emitDate = this.asUnix
                ? date.unix()
                : date.toISOString();

            this.$emit('input', emitDate);

            if (silent) {
                this.$emit('silent', emitDate);
            }
            else {
                this.$emit('change', emitDate);
            }
        },
    }
}
</script>

<style scoped>

</style>