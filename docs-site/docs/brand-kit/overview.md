# CreatorVaults Protocol

**CreatorVaults** is a premium, AI-powered asset management and generation system designed for the next generation of digital creators. Built with a focus on "Glass & Steel" aesthetics, it provides a secure, immutable-feeling environment for generating and storing creative assets.

## 💎 Features

- **Fabrication Studio**: Generate creative concepts (Text) and visuals (Images) using Google's Gemini 3 Flash and Gemini 2.5 Flash Image models.
- **Vault Dashboard**: A high-fidelity grid view of your generated assets with simulated telemetry.
- **Brand Identity System**: A fully documented "Protocol Identity" brand kit included within the app.
- **Live Terminal**: Simulated system logs and fabrication processes for a cinematic user experience.

## 🤖 AI & Brand Guidelines

We have included a dedicated context file for AI Agents (ChatGPT, Claude, etc.) to understand our brand identity when generating new code or assets.

👉 **[View AI Brand Guidelines](./brand-guidelines.md)**

You can paste the contents of this file into an LLM to ensure it generates UI and Copy that matches the **ERCreator4626** aesthetic (Colors, Typography, Tone of Voice).

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **AI**: Google GenAI SDK (`@google/genai`)
- **Typography**: Inter, JetBrains Mono, Doto
- **Architecture**: Vite build pipeline with Tailwind

## 🚀 Getting Started

### Prerequisites
You need a Google Gemini API Key. Get one at [aistudio.google.com](https://aistudio.google.com).

### Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/wenakita/CreatorVault.git
   cd CreatorVault
   ```

2. **Environment Setup**
   The application expects the API key to be available via `process.env.API_KEY`.
   
   If you are running in a standard local dev environment (like Vite), create a `.env` file:
   ```env
   VITE_API_KEY=your_api_key_here
   ```
   *(Note: You may need to update `services/geminiService.ts` to use `import.meta.env.VITE_API_KEY` if using Vite).*

   If running in a cloud IDE or specific container (like StackBlitz/Replit), set the `API_KEY` secret in your environment settings.

3. **Run the Frontend**
   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

## 🎨 Design System

Navigate to the **Design System** tab in the sidebar to view the `Protocol Identity` blueprint, including:
- Super-ellipse geometry specifications
- Holographic material layers
- Motion physics curves
- Typography and color tokens

## 📄 License

MIT License.
