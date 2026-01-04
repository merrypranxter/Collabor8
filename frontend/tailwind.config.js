const { fontFamily } = require("tailwindcss/defaultTheme")

module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', ...fontFamily.sans],
        display: ['Playfair Display', 'serif'],
      },
      colors: {
        border: "rgba(255, 255, 255, 0.06)",
        input: "rgba(255, 255, 255, 0.06)",
        ring: "#B87333",
        background: "#0B0E14",
        foreground: "#EAE6DF",
        primary: {
          DEFAULT: "#B87333",
          foreground: "#0B0E14",
        },
        secondary: {
          DEFAULT: "rgba(255, 255, 255, 0.05)",
          foreground: "#EAE6DF",
        },
        destructive: {
          DEFAULT: "#C55A4A",
          foreground: "#EAE6DF",
        },
        muted: {
          DEFAULT: "rgba(255, 255, 255, 0.04)",
          foreground: "#9A9AA3",
        },
        accent: {
          DEFAULT: "#D28C4C",
          foreground: "#0B0E14",
        },
        popover: {
          DEFAULT: "#0D1020",
          foreground: "#EAE6DF",
        },
        card: {
          DEFAULT: "rgba(255, 255, 255, 0.02)",
          foreground: "#EAE6DF",
        },
      },
      borderRadius: {
        lg: `8px`,
        md: `6px`,
        sm: "4px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}