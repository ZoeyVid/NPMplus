import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RawIntlProvider } from "react-intl";
import { ToastContainer } from "react-toastify";
import { AuthProvider, LocaleProvider, ThemeProvider } from "src/context";
import { intl } from "src/locale";
import EasyModal from "src/modules/easyModal";
import Router from "src/Router.tsx";

// Create a client
const queryClient = new QueryClient();

function App() {
	return (
		<RawIntlProvider value={intl}>
			<LocaleProvider>
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
								rtl={false}
								closeButton={false}
							/>
						</AuthProvider>
					</QueryClientProvider>
				</ThemeProvider>
			</LocaleProvider>
		</RawIntlProvider>
	);
}

export default App;
