import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";

const markup = renderToStaticMarkup(<App />);

if (!markup.includes('data-croco-ui-profile="astryx"')) {
  throw new Error("Astryx presentation smoke did not render the Croco UI profile marker");
}

if (!markup.includes('data-croco-auth-state="signed-out"')) {
  throw new Error("Astryx presentation smoke did not render the signed-out recovery state");
}

console.log("Astryx presentation smoke passed");
