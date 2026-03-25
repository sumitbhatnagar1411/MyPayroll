import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "@/lib/auth-context";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <title>Neurons Technologies LLC – Payroll</title>
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
