import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ryze AI - Deterministic UI Generator',
  description: 'Convert natural language into working React UI code',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
