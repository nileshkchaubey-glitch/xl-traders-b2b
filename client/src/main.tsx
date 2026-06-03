import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Load Umami analytics only when fully configured. Keeps the script (and its
// network request) out of deployments that haven't set these env vars.
const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
if (analyticsEndpoint && analyticsWebsiteId) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${analyticsEndpoint}/umami`;
  script.setAttribute("data-website-id", analyticsWebsiteId);
  document.body.appendChild(script);
}

createRoot(document.getElementById("root")!).render(<App />);
