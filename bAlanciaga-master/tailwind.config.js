import {
  shade,
  rounded,
  animations,
  components,
  grays,
  palettes
} from "@tailus/themer";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tailus/themer/dist/components/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
      animation: {
        fadeIn: "fadeIn 1s ease-in-out",
      },
      colors: {
        ...palettes.trust,
        gray: grays.neutral,
        softblack: "#000D3D",
        mainbg: "#252831",
        cardbg: "#33363F",
        modalbg: "#2d0000",
        borderbg: "#33363F",
        hoverbg: "#3B3E47",
        buttonbg: "#5a0000",
      },
      screens:{
        xxl:{raw: "(max-width: 1300px)"},
        xl:{raw: "(max-width: 940px)"},
        lg:{raw: "(max-width: 740px)"},
        md:{raw: "(max-width: 540px)"},
        sm: {raw: "(max-width: 450px)"}, // Example for small screens
        xxs: {raw: "(max-width: 400px)"}, // Example for small screens
      },
      backgroundImage: (theme) => ({
        "main-bgcolor": "linear-gradient(to bottom, black, #1a0000)",
      }),
    },
  },
  plugins: [shade, components, animations, rounded],
};
