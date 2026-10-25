import './globals.css';

export const metadata = {
  title: 'Local Chatbot',
  description: 'Local chatbot powered by Ollama and DeepSeek-R1'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
