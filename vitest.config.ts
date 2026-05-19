import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["test/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["extensions/**/*.ts"],
			exclude: ["test/**", "**/*.config.ts"],
		},
	},
});
