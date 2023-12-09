/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

const app = createApp(App)

registerPlugins(app)

app.mount('#app')

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(
    import.meta.env.MODE === 'production' ? '/sw.js' : '/dev-sw.js?dev-sw',
    { type: import.meta.env.MODE === 'production' ? 'classic' : 'module' }
  )
}
