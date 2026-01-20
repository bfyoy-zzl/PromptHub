import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css' // 👈 🔴 必须确保有这一行！

const app = createApp(App)
app.mount('#app')