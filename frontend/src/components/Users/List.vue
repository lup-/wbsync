<template>
    <v-container class="fill-height align-start">
        <v-row :align="isEmpty || isLoading ? 'center' : 'start'" :justify="isEmpty || isLoading ? 'center' : 'start'">
            <v-btn fab bottom right fixed large color="primary"
                    @click="$router.push({name: 'userNew'})"
            >
                <v-icon>mdi-plus</v-icon>
            </v-btn>

            <v-col cols="12">
                <v-data-table
                        dense
                        :headers="headers"
                        :items="users"
                        :loading="isLoading"
                        :items-per-page="50"
                >
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon small @click="gotoUserEdit(item.id)"><v-icon>mdi-pencil</v-icon></v-btn>
                        <v-btn icon small @click="deleteUser(item)"><v-icon>mdi-delete</v-icon></v-btn>
                    </template>
                </v-data-table>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        name: "UsersList",
        data() {
            return {
                isLoading: true,
                headers: [
                    {text: 'ФИО', value: 'name'},
                    {text: 'Логин', value: 'login'},
                    {text: 'Действия', value: 'actions', sortable: false},
                ]
            }
        },
        async mounted() {
            await this.loadUsers();
        },
        methods: {
            deleteUser(user) {
                this.$store.dispatch('deleteUser', user);
            },
            async loadUsers() {
                this.isLoading = true;
                await this.$store.dispatch('loadUsers', {});
                this.isLoading = false;
            },
            gotoUserEdit(id) {
                this.$router.push({name: 'userEdit', params: {id}});
            },
        },
        computed: {
            users() {
                return this.isLoading ? [] : this.$store.state.user.list;
            },
            isEmpty() {
                return this.users.length === 0 && this.isLoading === false;
            }
        }
    }
</script>

<style scoped>

</style>