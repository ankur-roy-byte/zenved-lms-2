import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

export const metadata = {
  title: "ZenVed — India's Deep-Tech Education Platform",
  description:
    "Specialised courses in AI, Drones, Semiconductors, and Defence — with admin, instructor and student panels, progress tracking and certification.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
