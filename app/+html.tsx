import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
        <meta content="#0B1410" name="theme-color" />
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta content="black-translucent" name="apple-mobile-web-app-status-bar-style" />
        <meta content="Платёжный календарь" name="apple-mobile-web-app-title" />
        <meta content="Личный календарь доходов и расходов" name="description" />
        <link href="/manifest.json" rel="manifest" />
        <link href="/payment-calendar-icon.png" rel="apple-touch-icon" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const globalStyles = `
  html, body, #root {
    min-height: 100%;
    margin: 0;
    background: #0B1410;
    overscroll-behavior: none;
  }

  body {
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: 100%;
  }

  * {
    box-sizing: border-box;
  }
`;
