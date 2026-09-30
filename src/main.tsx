import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { Effects } from "./components/Effects";
import { Footer, Storefront } from "./components/Storefront";
import "./index.css";
import { Crust } from "./pages/Crust";
import { Join } from "./pages/Join";
import { Kitchen } from "./pages/Kitchen";
import { Lobby } from "./pages/Lobby";
import { Market } from "./pages/Market";
import { NotFound } from "./pages/NotFound";
import { Sal } from "./pages/Sal";
import { Section } from "./pages/Section";
import { Tab } from "./pages/Tab";
import { Van } from "./pages/Van";
import { Wall } from "./pages/Wall";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 1_000 } },
});

function Pages() {
  const loc = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={loc.pathname}
        initial={{ opacity: 0, y: 18, rotate: -0.4 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22 }}
        className="tiles min-h-[70vh] px-4 py-6 sm:py-8"
      >
        <div className="mx-auto max-w-7xl">
          <Routes location={loc}>
            <Route path="/" element={<Lobby />} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/van" element={<Van />} />
            <Route path="/crust" element={<Crust />} />
            <Route path="/section/:cat" element={<Section />} />
            <Route path="/m/:slug" element={<Market />} />
            <Route path="/tab" element={<Tab />} />
            <Route path="/wall" element={<Wall />} />
            <Route path="/join" element={<Join />} />
            <Route path="/sal" element={<Sal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </motion.main>
    </AnimatePresence>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Storefront />
        <Pages />
        <Footer />
        <Effects />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
