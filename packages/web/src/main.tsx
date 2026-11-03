import "./preflight.css";
import "./index.css";
import "animate.css";

import "./i18n";
import { Provider } from "jotai";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashRouter } from "react-router-dom";
import { initDBImagesCacheStore } from "./db";
import { routes } from "./router/index.tsx";
import { ensureFileHelper } from "./stateV2/fileHelper.ts";
import { mainStore } from "./stateV2/store.ts";
import { initDayjs } from "./time.ts";
import { backendHealthCheck } from "./utils.ts";

initDayjs();
ensureFileHelper();
initDBImagesCacheStore();
backendHealthCheck();

const router = createHashRouter(routes);

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<Provider store={mainStore}>
			<RouterProvider router={router} />
		</Provider>
	</React.StrictMode>,
);
