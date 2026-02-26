import type { Metadata } from "next";
import { Chakra_Petch, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner'
import { DashboardProvider } from "@/contexts/DashboardContext";
import { 
  QuotesProvider, 
  ProjectsProvider, 
  CustomersProvider, 
  SubscriptionsProvider 
} from "@/contexts/DataContexts";

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  variable: "--font-chakra",
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Virtara | CRM",
  description: "Virtara CRM dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${chakraPetch.variable} ${sora.variable} antialiased`}
      >
        <DashboardProvider>
          <QuotesProvider>
            <ProjectsProvider>
              <CustomersProvider>
                <SubscriptionsProvider>
                  {children}
                </SubscriptionsProvider>
              </CustomersProvider>
            </ProjectsProvider>
          </QuotesProvider>
        </DashboardProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
