/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gcp: {
          blue:   "#1a73e8",
          dark:   "#1967d2",
          red:    "#ea4335",
          green:  "#34a853",
          yellow: "#fbbc04",
          bg:     "#f8f9fa",
          card:   "#ffffff",
          border: "#dadce0",
          text:   "#202124",
          muted:  "#5f6368",
          hover:  "#e8f0fe",
        },
      },
      fontFamily: {
        sans: ['"Google Sans"', '"Roboto"', 'Arial', 'sans-serif'],
        mono: ['"Roboto Mono"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};
