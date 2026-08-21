import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
    base: "/our-little-universe/",

    build: {
        rollupOptions: {
            input: {
                index: resolve(
                    process.cwd(),
                    "index.html"
                ),

                login: resolve(
                    process.cwd(),
                    "login.html"
                ),

                app: resolve(
                    process.cwd(),
                    "app.html"
                )
            }
        }
    }
});