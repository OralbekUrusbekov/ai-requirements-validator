/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      background: "var(--background)", foreground: "var(--foreground)", card: "var(--card)",
      primary: "var(--primary)", gold: "var(--gold)", muted: "var(--muted)", border: "var(--border)",
      destructive: "var(--destructive)", warning: "var(--warning)", success: "var(--success)", sidebar: "var(--sidebar)"
    }, borderRadius: { DEFAULT: "var(--radius)" }, fontFamily: { sans: ["Golos Text", "system-ui", "sans-serif"] }
  }},
  plugins: [],
};
