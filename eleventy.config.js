const { execSync } = require("child_process");

module.exports = async function (eleventyConfig) {
  eleventyConfig.on("eleventy.after", () => {
    execSync(
      "npx tailwindcss -i ./src/styles/main.css -o ./dist/css/styles.css --minify"
    );
  });
  return {
    markdownTemplateEngine: "liquid",
    dataTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
    cssTemplateEngine: "liquid",
    dir: {
      input: "src",
      pages: "pages",
      output: "dist",
    },
  };
};
