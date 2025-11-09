/// <reference types="vite/client" />

declare global {
  interface Window {
    __GRAPH_API_KEY__: string;
  }
}
