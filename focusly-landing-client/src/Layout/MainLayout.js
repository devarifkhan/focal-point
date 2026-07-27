import React from 'react';
import Header from "./Header";
import Footer from "./Footer";

const MainLayout = ({ children }) => {
    return (
        <div className="main-layout">
            {/* Header */}
            <Header />

            {/* Main Content Area */}
            <main>{children}</main>

            {/* Footer */}
            <Footer />
        </div>
    );
};

export default MainLayout;