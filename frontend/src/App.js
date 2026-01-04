import { BrowserRouter, Routes, Route } from "react-router-dom";
import Arena from "./pages/Arena";
import "./App.css";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <div className="App">
      <div className="grain-texture" />
      <div className="salon-vignette" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Arena />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;