<template>
    <v-row>
        <v-col cols="12" md="4">
            <v-text-field v-model="linkData.link" :label="index ? `Ссылка #${index+1}` : `Ссылка`"></v-text-field>
        </v-col>
        <v-col cols="12" md="4">
            <v-select
                v-model="linkData.extra"
                label="Вариант цены"
                :items="extraItems || []"
                :disabled="!extraItems"
                :loading="extraLoading"
            ></v-select>
        </v-col>
        <v-col cols="11" md="3">
            <v-text-field v-model="linkData.name" label="Название"></v-text-field>
        </v-col>
        <v-col cols="1">
            <v-btn icon @click="$emit('delete', linkData)"><v-icon>mdi-delete</v-icon></v-btn>
        </v-col>
    </v-row>
</template>

<script>
import clone from "lodash.clonedeep";
import axios from "axios";

function getDomain(link) {
    let url = new URL(link);
    let domain = url.hostname.toLowerCase();
    return domain;
}

export default {
    name: "ParseLinkForm",
    props: ['value', 'index'],
    data() {
        let linkData = this.value ? clone(this.value) : {};
        if (typeof(linkData) === 'string') {
            linkData = {
                link: linkData,
                extra: '',
                name: getDomain(linkData)
            }
        }

        return {
            linkData,
            extraItems: false,
            extraLoading: false,
        }
    },
    watch: {
        linkData: {
            deep: true,
            handler() {
                this.$emit('input', this.linkData);
            }
        },
        link() {
            this.loadVariants();
            if (!this.linkData.name) {
                this.linkData.name = getDomain(this.link);
            }
        }
    },
    mounted() {
        if (this.link) {
            this.loadVariants();
        }
    },
    methods: {
        async loadVariants() {
            this.extraLoading = true;
            try {
                let {data} = await axios.post('/api/parse/variants', {url: this.link});
                if (data && data.variants) {
                    this.extraItems = data.variants.map(variant => ({
                        text: variant.name,
                        value: variant.value
                    }));
                }
            }
            catch (e) {
                return;
            }
            this.extraLoading = false;
        }
    },
    computed: {
        link() {
            return this.linkData.link;
        }
    }

}
</script>

<style scoped>

</style>