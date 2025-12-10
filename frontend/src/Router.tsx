import { AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import {
	AnimatedPage,
	ErrorNotFound,
	LoadingPage,
	Page,
	SiteContainer,
	SiteFooter,
	SiteHeader,
	SiteMenu,
	Unhealthy,
} from "src/components";
import { useAuthState } from "src/context";
import { useHealth } from "src/hooks";

const Setup = lazy(() => import("src/pages/Setup"));
const Login = lazy(() => import("src/pages/Login"));
const Dashboard = lazy(() => import("src/pages/Dashboard"));
const Settings = lazy(() => import("src/pages/Settings"));
const Certificates = lazy(() => import("src/pages/Certificates"));
const Access = lazy(() => import("src/pages/Access"));
const AuditLog = lazy(() => import("src/pages/AuditLog"));
const Users = lazy(() => import("src/pages/Users"));
const ProxyHosts = lazy(() => import("src/pages/Nginx/ProxyHosts"));
const RedirectionHosts = lazy(() => import("src/pages/Nginx/RedirectionHosts"));
const DeadHosts = lazy(() => import("src/pages/Nginx/DeadHosts"));
const Streams = lazy(() => import("src/pages/Nginx/Streams"));

function Content() {
	const location = useLocation();
	return (
		<AnimatePresence mode="wait">
			<Routes location={location} key={location.pathname}>
				<Route
					path="*"
					element={
						<AnimatedPage>
							<ErrorNotFound />
						</AnimatedPage>
					}
				/>
				<Route
					path="/certificates"
					element={
						<AnimatedPage>
							<Certificates />
						</AnimatedPage>
					}
				/>
				<Route
					path="/access"
					element={
						<AnimatedPage>
							<Access />
						</AnimatedPage>
					}
				/>
				<Route
					path="/audit-log"
					element={
						<AnimatedPage>
							<AuditLog />
						</AnimatedPage>
					}
				/>
				<Route
					path="/settings"
					element={
						<AnimatedPage>
							<Settings />
						</AnimatedPage>
					}
				/>
				<Route
					path="/users"
					element={
						<AnimatedPage>
							<Users />
						</AnimatedPage>
					}
				/>
				<Route
					path="/nginx/proxy"
					element={
						<AnimatedPage>
							<ProxyHosts />
						</AnimatedPage>
					}
				/>
				<Route
					path="/nginx/redirection"
					element={
						<AnimatedPage>
							<RedirectionHosts />
						</AnimatedPage>
					}
				/>
				<Route
					path="/nginx/404"
					element={
						<AnimatedPage>
							<DeadHosts />
						</AnimatedPage>
					}
				/>
				<Route
					path="/nginx/stream"
					element={
						<AnimatedPage>
							<Streams />
						</AnimatedPage>
					}
				/>
				<Route
					path="/"
					element={
						<AnimatedPage>
							<Dashboard />
						</AnimatedPage>
					}
				/>
			</Routes>
		</AnimatePresence>
	);
}

function Router() {
	const health = useHealth();
	const { authenticated } = useAuthState();

	if (health.isLoading) {
		return <LoadingPage />;
	}

	if (health.isError || health.data?.status !== "OK") {
		return <Unhealthy />;
	}

	if (!health.data?.setup) {
		return <Setup />;
	}

	if (!authenticated) {
		return (
			<Suspense fallback={<LoadingPage />}>
				<Login />
			</Suspense>
		);
	}

	return (
		<BrowserRouter>
			<Page>
				<div>
					<SiteHeader />
					<SiteMenu />
				</div>
				<SiteContainer>
					<Suspense fallback={<LoadingPage noLogo />}>
						<Content />
					</Suspense>
				</SiteContainer>
				<SiteFooter />
			</Page>
		</BrowserRouter>
	);
}

export default Router;
