import Vue from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify';
import {router, store} from './router'

Vue.config.productionTip = false

Vue.config.errorHandler = function (err) {
  let skipError = err.toString().toLowerCase().indexOf('navigation') !== -1;
  if (skipError) {
    return;
  }

  if (vueInstance) {
    vueInstance.$store.commit('setAppError', err);
  }
  let c = console;
  c.error(err);
};

let vueInstance = new Vue({
  vuetify,
  store,
  router,
  render: h => h(App)
}).$mount('#app')
