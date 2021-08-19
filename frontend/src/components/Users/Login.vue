<template>
    <v-container class="fill-height align-center justify-center">
        <v-card>
            <v-card-text>
                <v-form ref="form" v-model="valid">
                    <v-text-field
                            v-model="login"
                            label="Логин"
                            required
                    ></v-text-field>

                    <v-text-field
                            v-model="password"
                            :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                            :type="showPassword ? 'text' : 'password'"
                            label="Пароль"
                            required
                            @click:append="showPassword = !showPassword"
                    ></v-text-field>
                </v-form>
            </v-card-text>
            <v-card-actions>
                <v-btn :disabled="!valid" color="success" @click="doLogin">
                    Войти
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-container>
</template>

<script>
    export default {
        data() {
            return {
                login: '',
                password: '',
                valid: false,
                showPassword: false,
            }
        },
        watch: {
            login() {
                this.validate();
            },
            password() {
                this.validate();
            }
        },
        methods: {
            validate() {
                this.$refs.form.validate();
            },
            async doLogin() {
                await this.$store.dispatch('loginUser', {login: this.login, password: this.password});
                if (this.$store.getters.isLoggedIn) {
                    let nextRoute = '/';
                    return this.$router.push({path: nextRoute});
                }
            }
        }
    }
</script>

<style scoped>

</style>