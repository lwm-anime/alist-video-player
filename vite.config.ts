// Plugins
import vue from "@vitejs/plugin-vue";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
// import ViteFonts from 'unplugin-fonts/vite'
import { VitePWA } from "vite-plugin-pwa";

// Utilities
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

import { ViteDevServer } from "vite";
import history from "connect-history-api-fallback";

function pluginRewriteAll() {
  return {
    name: "rewrite-all",
    configureServer(server: ViteDevServer) {
      return () => {
        const handler = history({
          disableDotRule: true,
          rewrites: [{ from: /\/$/, to: () => "/index.html" }],
        });

        server.middlewares.use((req, res, next) => {
          // @ts-ignore
          handler(req, res, next);
        });
      };
    },
  };
}

const env = loadEnv("", process.cwd());
// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    vuetify({
      autoImport: true,
      styles: {
        configFile: "src/styles/settings.scss",
      },
    }),
    VitePWA({
      srcDir: "src",
      filename: "sw.ts",
      strategies: "injectManifest",
      injectRegister: false,
      manifest: false,
      registerType: 'autoUpdate',
      injectManifest: {
        injectionPoint: undefined,
      },
      devOptions: {
        enabled: true,
        type: "module"
      }
    }),
    pluginRewriteAll(),
  ],
  define: { "process.env": {} },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: env.VITE_ALIST_URL,
        changeOrigin: true,
      },
    },
  },
});
