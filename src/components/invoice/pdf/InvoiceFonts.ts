import { Font } from "@react-pdf/renderer";

// Register Termina Extra Bold for header
Font.register({
  family: "Termina",
  fonts: [
    {
      src: "https://fonts.cdnfonts.com/s/15011/TerminaW00-ExtraBold.woff",
      fontWeight: 800,
    },
  ],
});

// Register Helvetica Neue for body text
Font.register({
  family: "HelveticaNeue",
  fonts: [
    {
      src: "https://db.onlinewebfonts.com/t/1e93b9f16d3768235877f5d2636e75d9.woff",
      fontWeight: "normal",
    },
    {
      src: "https://db.onlinewebfonts.com/t/bd64426c4b604f0af538e9789d9e20e2.woff",
      fontWeight: "bold",
    },
  ],
});
