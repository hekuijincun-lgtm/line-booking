import React from "react";
import ReactDOM from "react-dom/client";
import Landing from "./pages/Landing";
import './index.css';
import './styles/animations.css';
import { initScrollReveal } from './lib/scrollReveal';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Landing />
  </React.StrictMode>
);
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    try {
      initScrollReveal();
    } catch (e) {
      console.error("initScrollReveal failed", e);
    }
  });
}

