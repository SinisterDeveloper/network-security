import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zero Trust IoT Network Security',
  description: 'Minimal System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground font-mono antialiased">
        {children}
      </body>
    </html>
  );
}