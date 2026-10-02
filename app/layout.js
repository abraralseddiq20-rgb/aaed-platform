import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
});

export const metadata = {
  title: "عائد | Aaed",
  description: "رفيقك في رحلة العودة",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className={tajawal.className}>{children}</body>
    </html>
  );
}