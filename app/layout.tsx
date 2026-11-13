import type { Metadata } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sc",
});

export const metadata: Metadata = {
  title: "HSK Master - Ứng dụng Ôn Tập Từ Vựng Tiếng Trung",
  description:
    "Website ôn tập từ vựng tiếng Trung HSK 1-6 với Flashcard, Trắc nghiệm, Điền từ, Phát âm chuẩn và Bảng xếp hạng.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansSC.variable} font-sans min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
