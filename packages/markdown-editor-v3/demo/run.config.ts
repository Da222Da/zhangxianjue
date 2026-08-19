import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import pluginVue from "@vitejs/plugin-vue";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const server = await createServer({
    configFile: false,
    root: __dirname,
    plugins: [pluginVue()],
    server: {
      port: 8080,
      host: "0.0.0.0",
      open: true,
    },
  });
  await server.listen();
  server.printUrls();
})();
