<template>
    <v-container class="fill-height align-start">
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title>{{isNew ? 'Новый пользователь' : 'Редактирование пользователя'}}</v-card-title>
                    <v-card-text>
                        <v-form autocomplete="off">
                            <v-text-field
                                    v-model="user.name"
                                    label="Имя"
                            ></v-text-field>
                            <v-text-field
                                    v-model="user.login"
                                    label="Логин"
                            ></v-text-field>
                            <v-text-field
                                    v-model="user.password"
                                    :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                                    :type="showPassword ? 'text' : 'password'"
                                    label="Пароль"
                                    autocomplete="new-password"
                                    @click:append="showPassword = !showPassword"
                            ></v-text-field>
                            <v-switch v-model="user.isAdmin" label="Администратор" v-if="hasRights('usersList')"></v-switch>
                            <v-autocomplete v-if="hasRights('usersList')"
                                    :items="rights"
                                    v-model="user.rights"
                                    chips
                                    deletable-chips
                                    multiple
                                    label="Права доступа"
                            ></v-autocomplete>
                        </v-form>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn @click="$router.push({name: 'usersList'})">К списку</v-btn>
                        <v-btn large color="primary" @click="save">Сохранить</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        data() {
            return {
                user: {},
                defaultUser: {},
                showPassword: false,
            }
        },
        async created() {
            if (this.userId) {
                if (this.allUsers.length === 0) {
                    await this.$store.dispatch('loadUsers');
                }

                this.$store.dispatch('setEditUser', this.userId);
            }
        },
        watch: {
            userId() {
                this.$store.dispatch('setEditUser', this.userId);
            },
            allUsers: {
                deep: true,
                handler() {
                    if (this.userId) {
                        this.$store.dispatch('setEditUser', this.userId);
                    }
                }
            },
            storeUser() {
                if (this.storeUser) {
                    this.user = this.storeUser;
                }
                else {
                    this.user = this.defaultUser;
                }
            },
        },
        methods: {
            async save() {
                if (this.isNew) {
                    await this.$store.dispatch('newUser', this.user);
                }
                else {
                    await this.$store.dispatch('editUser', this.user);
                }

                await this.$router.push({name: 'usersList'});
            },
            hasRights(code) {
                return this.$store.getters.userHasRights(code);
            },
        },
        computed: {
            isNew() {
                return !(this.$route.params && this.$route.params.id);
            },
            userId() {
                return (this.$route.params && this.$route.params.id) || false;
            },
            storeUser() {
                return this.$store.state.user.edit;
            },
            allUsers() {
                return this.$store.state.user.list;
            },
            rights() {
                return this.$store.state.routes.map(route => ({text: route.title, value: route.code}));
            },
            currentUser() {
                return this.$store.state.user.current;
            }
        }
    }
</script>

<style scoped>

</style>