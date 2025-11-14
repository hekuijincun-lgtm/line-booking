import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/global.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Login from "./pages/Login";
import Slots from "./pages/Slots";
import Reserve from "./pages/Reserve";

const router = createBrowserRouter([
  { path: "/", element: <Home/> },
  { path: "/login", element: <Login/> },
  { path: "/slots", element: <Slots/> },
  { path: "/reserve", element: <Reserve/> },
]);

function Home(){
  return (
    <div className="min-h-[100dvh] grid place-items-center p-6">
      <div className="w-full max-w-xl bg-[var(--card)] rounded-2xl p-6 shadow-xl">
        <h1 className="text-3xl font-bold mb-3">Salon Booking</h1>
        <p className="opacity-80 mb-6">空き枠の確認・予約ができます。</p>
        <div className="flex gap-3">
          <a className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-semibold" href="/login">LINEログイン</a>
          <a className="px-4 py-2 rounded-xl bg-white/10" href="/slots">空き枠を見る</a>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

