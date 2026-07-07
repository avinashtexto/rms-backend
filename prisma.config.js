require("dotenv/config");
const { defineConfig, env } = require("prisma/config");

module.exports = defineConfig({
  schema: "src/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
