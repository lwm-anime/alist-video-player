// Composables
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/:paths*/',
    component: () => import('@/views/VideoList.vue'),
  },
  {
    path: '/:paths*',
    component: () => import('@/views/VideoPlayer.vue')
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
  strict: true
})

export default router
