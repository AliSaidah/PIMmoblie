import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        success: "#16a34a", // verde: entrada / sucesso
        danger: "#dc2626", // vermelho: pendências
        navy: "#1e3a5f", // navy: cards de resumo
      },
    },
  },
  plugins: [],
};

export default config;
