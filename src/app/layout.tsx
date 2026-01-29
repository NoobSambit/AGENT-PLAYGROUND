import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/ui/navigation";
import { AnimatedBackground } from "@/components/ui/animated-background";

export const metadata: Metadata = {
  title: "AI Agent Playground",
  description: "Create, manage, and interact with intelligent AI agents in a professional environment designed for seamless collaboration",
  keywords: ["AI", "agents", "playground", "LLM", "chatbot", "simulation"],
  authors: [{ name: "Agent Playground Team" }],
  openGraph: {
    title: "AI Agent Playground",
    description: "Create, manage, and interact with intelligent AI agents",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <AnimatedBackground variant="default" />
        <Navigation />
        <main className="relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
