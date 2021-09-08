<template>
    <v-app id="signals_bot">
        <v-alert type="error" v-model="showError" dismissible tile class="global-error">{{appError}}</v-alert>
        <v-navigation-drawer v-model="drawer" app clipped :mini-variant="mini" :permanent="mini" v-if="isLoggedIn">
            <v-list dense>
                <v-list-item v-for="route in routes" :key="route.code"
                    link
                    @click="$router.push({name: route.code})"
                    :disabled="$route.name === route.code"
                >
                    <v-list-item-action>
                        <v-icon v-text="route.icon" :disabled="$route.name === route.code"></v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>{{route.title}}</v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
            </v-list>
            <template v-slot:append>
                <v-list dense>
                    <v-list-item link @click="mini = !mini">
                        <v-list-item-action>
                            <v-icon>mdi-unfold-more-vertical</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>{{mini ? "Полный вид" : "Мини вид"}}</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                    <v-list-item v-if="$store.getters.isLoggedIn" link @click="logout">
                        <v-list-item-action>
                            <v-icon>mdi-logout</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Выход</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </v-list>
            </template>
        </v-navigation-drawer>

        <v-app-bar app clipped-left>
            <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
            <v-toolbar-title>Остаткино</v-toolbar-title>
            <v-spacer></v-spacer>
            <router-view name="header"></router-view>
            <v-progress-linear
                    :active="isLoading"
                    :indeterminate="isLoading"
                    absolute
                    bottom
            ></v-progress-linear>
        </v-app-bar>

        <v-main>
            <router-view name="content"></router-view>
        </v-main>

        <v-snackbar v-model="showMessage" :timeout="5000" :color="appMessage.color">
            {{ appMessage.text }}
            <template v-slot:action="{ attrs }">
                <v-btn icon v-bind="attrs" @click="showMessage = false"> <v-icon>mdi-close</v-icon></v-btn>
            </template>
        </v-snackbar>
    </v-app>
</template>

<script>
    export default {
        name: 'App',
        data: () => ({
            drawer: null,
            showError: false,
            showMessage: false,
            mini: true,
        }),
        watch: {
            appError() {
                this.showError = true;
            },
            appMessage() {
                this.showMessage = true;
            }
        },
        methods: {
            async logout() {
                await this.$store.dispatch('logoutUser');
                return this.$router.push({name: 'login'});
            }
        },
        computed: {
            appError() {
                return this.$store.state.appError;
            },
            appMessage() {
                return this.$store.state.appMessage;
            },
            routes() {
                return this.$store.getters.allowedRoutes;
            },
            isLoggedIn() {
                return this.$store.getters.isLoggedIn;
            },
            isLoading() {
                return this.$store.state.loading;
            }
        }
    }
</script>

<style>
    .v-application .error {z-index: 100}
    .v-navigation-drawer--fixed {z-index: 1000}
</style>
