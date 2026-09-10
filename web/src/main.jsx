import { createRoot } from "react-dom/client";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import PosPage from "./pages/PosPage.jsx";
import CustomerDisplayPage from "./pages/CustomerDisplayPage.jsx";
import "./styles.css";

const ROUTES = {
  "/pos": PosPage,
  "/display": CustomerDisplayPage,
};

const Page = ROUTES[window.location.pathname] ?? OnboardingPage;

createRoot(document.getElementById("root")).render(<Page />);
