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
        border: "rgba(255, 255, 255, 0.08)",
        input: "rgba(255, 255, 255, 0.08)",
        ring: "#FFFFFF",
        background: "#0A0A0A",
        foreground: "#F5F5F5",
        primary: {
          DEFAULT: "#FFFFFF",
          foreground: "#0A0A0A",
        },
        secondary: {
          DEFAULT: "rgba(255, 255, 255, 0.05)",
          foreground: "#F5F5F5",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#F5F5F5",
        },
        muted: {
          DEFAULT: "rgba(255, 255, 255, 0.04)",
          foreground: "#A1A1A1",
        },
        accent: {
          DEFAULT: "#E5E5E5",
          foreground: "#0A0A0A",
        },
        popover: {
          DEFAULT: "#141414",
          foreground: "#F5F5F5",
        },
        card: {
          DEFAULT: "rgba(255, 255, 255, 0.02)",
          foreground: "#F5F5F5",
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