import "./auth/namespace";
import "./preflight.css";
import "./index.css";
import "animate.css";

import "./i18n";
import { Provider } from "jotai";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashRouter } from "react-router-dom";
import AuthGate from "./auth/AuthGate.tsx";
import { initDBImagesCacheStore } from "./db";
import { routes } from "./router/index.tsx";
import { ensureFileHelper } from "./stateV2/fileHelper.ts";
import { mainStore } from "./stateV2/store.ts";
import { initDayjs } from "./time.ts";
import { backendHealthCheck } from "./utils.ts";
import { startVersionCheck } from "./versionCheck.ts";

// 禁止 iOS 双指缩放 / 双击缩放，像原生 App 一样
for (const evt of ["gesturestart", "gesturechange", "gestureend"]) {
	document.addEventListener(evt, (e) => e.preventDefault());
}

initDayjs();
ensureFileHelper();
initDBImagesCacheStore();
backendHealthCheck();
startVersionCheck();

const router = createHashRouter(routes);

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<Provider store={mainStore}>
			<AuthGate>
				<RouterProvider router={router} />
			</AuthGate>
		</Provider>
	</React.StrictMode>,
);
