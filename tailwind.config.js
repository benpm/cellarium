const colors = require("tailwindcss/colors");

module.exports = {
  purge: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        light: "#efefef",
        medium: "#999999",
        meddark: "#555555",
        dark: "#222222",
        accent: "#fe9920"
      }
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
