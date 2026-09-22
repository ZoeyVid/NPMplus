import { QueryClientProvider } from "@tanstack/react-query";
import { RawIntlProvider } from "react-intl";
import { ToastContainer } from "react-toastify";
import { queryClient } from "src/api/backend/base";
import { AuthProvider, ThemeProvider } from "src/context";
import { intl } from "src/locale";
import EasyModal from "src/modules/easyModal";
import Router from "src/Router.jsx";

function App() {
	return (
		<RawIntlProvider value={intl}>
			<ThemeProvider>
				<QueryClientProvider client={queryClient}>
					<AuthProvider>
						<EasyModal.Provider>
							<Router />
						</EasyModal.Provider>
						<ToastContainer
							position="top-right"
							autoClose={5000}
							hideProgressBar={true}
							newestOnTop={true}
							closeOnClick={true}
							rtl={document.dir === "rtl"}
							closeButton={false}
						/>
					</AuthProvider>
				</QueryClientProvider>
			</ThemeProvider>
		</RawIntlProvider>
	);
}

export default App;
