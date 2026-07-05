import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Voter — Public Opinion Platform',
  description:
    'A trusted civic space for verified Nigerians to vote in opinion polls on elections, governance, and national issues.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
