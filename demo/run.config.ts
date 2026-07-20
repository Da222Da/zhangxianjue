import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
import pluginVue from "@vitejs/plugin-vue";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log("__dirname::: ", __dirname);

(async () => {
  const server = await createServer({
    configFile: false,
    root: __dirname,
    plugins: [pluginVue()],

    server: {
      port: 8080,
      host: "0.0.0.0",
      open: true,
      cors: true,
    },
  });
  await server.listen();
  server.printUrls();
})();
