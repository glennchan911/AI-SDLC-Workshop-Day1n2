import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'Singapore timezone todo app with WebAuthn authentication',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
