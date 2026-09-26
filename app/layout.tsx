import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Temple Study — project scaffold', description: 'Hackathon app scaffold' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
