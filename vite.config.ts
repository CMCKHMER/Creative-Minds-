import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
// Note: vite-plugin-singlefile was removed so that React.lazy() can split
// heavy modals and the games route into separate chunks. A relative base
// keeps asset URLs correct on a GitHub Pages project subpath.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Keep the Firebase SDK family OUT of the eager vendor chunk: the
          // app dynamic-imports firebase (src/lib/firebase.ts lazy getters),
          // and rollup only honors that if manualChunks does not force these
          // modules into the always-loaded vendor bundle.
          // Same for the 3D chess family (three.js + react-three-fiber +
          // drei + chess.js + their helper packages): only the Brain Lounge
          // chess cartridge imports them, so they must stay inside its lazy
          // chunk (~1.4 MB of three.js must not land on every visitor).
          if (/[\\/](firebase|@firebase|@grpc|protobufjs|@protobufjs|@google|faye-websocket|three|@react-three|chess\.js|troika|maath|camera-controls|@use-gesture|its-fine|suspend-react|react-use-measure|zustand|stats-gl|stats\.js|meshline|bidi-js|glsl-noise|glsl-tokenizer|@monogrid|detect-gpu|three-mesh-bvh|tunnel-rat|fflate|draco3d|potpack|webgl-sdf|hls\.js|@mediapipe|use-sync-external-store|utility-types)/.test(id)) {
            return undefined;
          }
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
