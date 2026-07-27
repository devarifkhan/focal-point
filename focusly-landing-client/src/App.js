import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthLayout from './Layout/AuthLayout';
import MainLayout from "./Layout/MainLayout";
import HomePage from './pages/HomePage';
import NotFoundPage from "./pages/NotFoundPage";
import Path from "./networks/path";
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = React.lazy(() => import('./pages/TermsServicePage'));
const Login = React.lazy(() => import('./pages/auth/Login'));
const Register = React.lazy(() => import('./pages/auth/Registration'));
const ForgotPassword = React.lazy(() => import('./pages/auth/ForgotPassword'));
const EmailVerification = React.lazy(() => import('./pages/auth/EmailVerification'));
const Dashboard = React.lazy(() => import('./pages/dashboard/Dashboard'));
const Checkout = React.lazy(() => import('./pages/payment/Checkout'));
const PaymentResult = React.lazy(() => import('./pages/payment/PaymentResult'));

const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path={Path.home} element={<MainLayout><HomePage/></MainLayout>}/>
                <Route path={Path.signIn} element={<AuthLayout><Login/></AuthLayout>}/>
                <Route path={Path.signUp} element={<AuthLayout><Register/></AuthLayout>}/>
                <Route path={Path.emailVerification} element={<AuthLayout><EmailVerification/></AuthLayout>}/>
                <Route path={Path.forgotPassword} element={<AuthLayout><ForgotPassword/></AuthLayout>}/>
                <Route path={Path.dashboard} element={<MainLayout><Dashboard/></MainLayout>}/>
                <Route path={Path.checkout} element={<MainLayout><Checkout/></MainLayout>}/>
                <Route path={Path.paymentResult} element={<MainLayout><PaymentResult/></MainLayout>}/>
                <Route path={Path.privacyPolicy} element={<MainLayout><PrivacyPolicyPage/></MainLayout>}/>
                <Route path={Path.termsOfService} element={<MainLayout><TermsOfServicePage/></MainLayout>}/>
                {/* Fallback route for 404 Not Found */}
                <Route path="*" element={<MainLayout><NotFoundPage/></MainLayout>}/>
            </Routes>
        </BrowserRouter>
    );
};

export default App;