<template>
  <v-app class="app">
    <!-- <app-bar /> -->
    <router-view />
  </v-app>
</template>

<script lang="ts" setup>
import AppBar from './components/AppBar.vue';
</script>

<style scoped>
.app {
  width: 100%;
}
</style>

<style>
@import "vuetify/lib/components/VGrid/VGrid.css";
html {
  overflow-y: auto;
}
</style>
