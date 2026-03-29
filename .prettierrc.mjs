export default {
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
  tailwindStylesheet: "src/index.css",
  tailwindFunctions: ["cn", "cva"],
  overrides: [
    {
      // Match shadcn/ui's default formatting to avoid unnecessary diffs against upstream.
      files: "src/shadcn/**",
      options: {
        semi: false,
        trailingComma: "es5",
      },
    },
  ],
};
