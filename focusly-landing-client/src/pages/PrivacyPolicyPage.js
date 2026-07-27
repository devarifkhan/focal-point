import React, {useEffect} from 'react';

const PrivacyPolicyPage = () => {
    useEffect(() => {
        document.title = "Privacy Policy - Focusly";
        // scroll to top
        window.scrollTo(0, 0);
    }, []);
    return (
        <div className="privacy-policy-main">
            <div className="container">
                <h1>Privacy Policy</h1>
                <p><strong>Last Updated:</strong> 18 Aug, 2025</p>

                <p>
                    Welcome to <strong>Focusly.pro</strong> ("the Plugin"). Your privacy is
                    important to us, and this Privacy Policy explains how we collect, use,
                    store, and protect your personal information when you use our Chrome
                    extension and web application.
                </p>

                <h2>1. Information We Collect</h2>
                <p>
                    To provide the best experience and ensure the functionality of the
                    Plugin, we collect the following types of information:
                </p>

                <h3>1.1. Domains You Block</h3>
                <p>
                    When you input domains to block using <strong>Focusly.pro</strong>, we
                    store these domain names in our database. This includes URLs, domain patterns,
                    and subdomain configurations. This allows the Plugin to function properly by
                    blocking access to the specified domains. The domains you block are associated
                    with your account for personalization purposes.
                </p>

                <h3>1.2. User Account Information</h3>
                <p>
                    To create an account, you will be required to provide certain personal
                    information, such as:
                </p>
                <ul>
                    <li><strong>Name</strong></li>
                    <li><strong>Email Address</strong></li>
                    <li><strong>Password</strong> (hashed and securely stored)</li>
                    <li><strong>Account preferences and settings</strong></li>
                    <li><strong>Authentication tokens and session data</strong></li>
                </ul>
                <p>
                    This information is used to identify your account and manage your
                    preferences.
                </p>

                <h3>1.3. Usage and Analytics Data</h3>
                <p>
                    We collect detailed usage information to provide analytics and improve your experience:
                </p>
                <ul>
                    <li><strong>Time tracking data:</strong> Daily usage metrics for blocked websites</li>
                    <li><strong>Blocking patterns:</strong> When and how often you block specific domains</li>
                    <li><strong>Feature usage:</strong> Which features you use (instant block, scheduled blocks, etc.)</li>
                    <li><strong>Usage warnings:</strong> Data related to 50% and 75% usage notifications</li>
                    <li><strong>Schedule data:</strong> Your blocking schedules and time preferences</li>
                    <li><strong>Device information:</strong> Browser type, version, and basic system information</li>
                </ul>

                <h3>1.4. Customization Data</h3>
                <p>
                    We store your personalization preferences including:
                </p>
                <ul>
                    <li><strong>Custom background images:</strong> Images you upload for interface personalization</li>
                    <li><strong>Custom messages:</strong> Motivational messages and productivity reminders you create</li>
                    <li><strong>Time zone information:</strong> Automatically detected for accurate daily resets</li>
                    <li><strong>Default time limits:</strong> Your configured standard time limits for different categories</li>
                </ul>

                <h3>1.5. Calendar Integration Data</h3>
                <p>
                    If you choose to integrate with calendar services, we may access:
                </p>
                <ul>
                    <li><strong>Calendar events:</strong> For scheduling automatic blocks</li>
                    <li><strong>Calendar permissions:</strong> As granted by you for integration purposes</li>
                </ul>

                <h3>1.6. Payment Information</h3>
                <p>
                    For premium subscriptions, we collect billing information through secure
                    third-party payment processors. We do not store complete credit card details
                    on our servers. Payment data is processed by our payment partners in compliance
                    with PCI DSS standards.
                </p>

                <h2>2. How We Use Your Information</h2>
                <p>We use the information we collect for the following purposes:</p>
                <ul>
                    <li>
                        <strong>Core Functionality:</strong> To enable website blocking, time tracking,
                        usage analytics, and all primary features of <strong>Focusly.pro</strong>
                    </li>
                    <li>
                        <strong>Personalization:</strong> To tailor the Plugin to your preferences,
                        display custom messages and backgrounds, and provide personalized analytics
                    </li>
                    <li>
                        <strong>Cross-device Synchronization:</strong> To sync your data across devices
                        through our cloud infrastructure
                    </li>
                    <li>
                        <strong>Usage Analytics:</strong> To provide daily usage reports and insights
                        into your productivity patterns
                    </li>
                    <li>
                        <strong>Communication:</strong> To send important updates, subscription notifications,
                        and respond to your inquiries
                    </li>
                    <li>
                        <strong>Service Improvement:</strong> To analyze usage patterns and improve
                        the Plugin's performance, reliability, and user experience
                    </li>
                    <li>
                        <strong>Security:</strong> To detect and prevent unauthorized access and abuse
                    </li>
                </ul>

                <h2>3. How We Protect Your Information</h2>
                <p>
                    We implement comprehensive security measures to protect your personal information:
                </p>
                <ul>
                    <li>
                        <strong>Encryption:</strong> All sensitive data is encrypted during transmission
                        using industry-standard SSL/TLS protocols and encrypted at rest in our databases
                    </li>
                    <li>
                        <strong>Token-based Authentication:</strong> We use enterprise-grade session
                        tokens with automatic expiration for secure account access
                    </li>
                    <li>
                        <strong>Access Controls:</strong> Only authorized personnel have access to
                        your data, with role-based access restrictions
                    </li>
                    <li>
                        <strong>Local Data Storage:</strong> Critical blocking functionality can operate
                        locally on your device, reducing data exposure
                    </li>
                    <li>
                        <strong>Regular Security Audits:</strong> We conduct regular security assessments
                        and vulnerability testing
                    </li>
                    <li>
                        <strong>Secure Infrastructure:</strong> Our servers are hosted in secure,
                        certified data centers with appropriate physical and digital safeguards
                    </li>
                </ul>

                <h2>4. Cookies and Local Storage</h2>
                <p>
                    We use cookies and browser storage technologies for:
                </p>
                <ul>
                    <li><strong>Authentication:</strong> Storing secure session tokens</li>
                    <li><strong>Preferences:</strong> Remembering your settings and customizations</li>
                    <li><strong>Offline Functionality:</strong> Enabling local plugin operation</li>
                    <li><strong>Analytics:</strong> Understanding how you use our service</li>
                </ul>
                <p>
                    You can control cookie settings through your browser, though some functionality
                    may be limited if cookies are disabled.
                </p>

                <h2>5. Third-Party Integrations</h2>
                <p>
                    <strong>Focusly.pro</strong> may integrate with third-party services:
                </p>
                <ul>
                    <li><strong>Calendar Services:</strong> For scheduling and productivity features</li>
                    <li><strong>Analytics Providers:</strong> For service improvement (data is anonymized)</li>
                    <li><strong>Payment Processors:</strong> For handling subscription payments securely</li>
                    <li><strong>Cloud Infrastructure:</strong> For reliable service hosting and data backup</li>
                </ul>
                <p>
                    These integrations are governed by their respective privacy policies, and we
                    ensure they meet our privacy and security standards.
                </p>

                <h2>6. Sharing Your Information</h2>
                <p>
                    We do not sell, trade, or otherwise transfer your personal information
                    to third parties except in the following circumstances:
                </p>
                <ul>
                    <li>
                        <strong>Service Providers:</strong> We may share your information with
                        trusted third-party service providers who assist us in operating
                        <strong> Focusly.pro</strong>, conducting our business, or servicing
                        you (e.g., hosting services, analytics tools, payment processors).
                        These providers are contractually obligated to keep your information confidential.
                    </li>
                    <li>
                        <strong>Legal Requirements:</strong> We may disclose your information
                        if required by law or in response to valid legal requests (e.g., court
                        orders, subpoenas).
                    </li>
                    <li>
                        <strong>Business Transfers:</strong> In the event of a merger, acquisition,
                        or sale of assets, your information may be transferred as part of that transaction.
                    </li>
                </ul>

                <h2>7. International Data Transfers</h2>
                <p>
                    Your information may be processed and stored in countries outside your residence.
                    We ensure that such transfers comply with applicable data protection laws and
                    implement appropriate safeguards, including standard contractual clauses and
                    adequacy decisions where applicable.
                </p>

                <h2>8. Your Rights and Choices</h2>
                <p>
                    Depending on your location, you may have certain rights regarding your
                    personal information, including:
                </p>
                <ul>
                    <li>
                        <strong>Access and Portability:</strong> You can request access to the
                        personal information we hold about you and receive a copy in a portable format
                    </li>
                    <li>
                        <strong>Correction:</strong> You can request correction of inaccurate
                        personal information
                    </li>
                    <li>
                        <strong>Deletion:</strong> You can request deletion of your personal
                        information, subject to applicable laws and legitimate business needs
                    </li>
                    <li>
                        <strong>Restriction:</strong> You can request restriction of processing
                        in certain circumstances
                    </li>
                    <li>
                        <strong>Objection:</strong> You can object to processing based on
                        legitimate interests
                    </li>
                    <li>
                        <strong>Opt-Out:</strong> You can opt-out of receiving promotional
                        communications from us at any time
                    </li>
                    <li>
                        <strong>Withdraw Consent:</strong> Where processing is based on consent,
                        you can withdraw it at any time
                    </li>
                </ul>
                <p>
                    To exercise these rights, please contact us at &nbsp;
                    <a href="mailto:hello@shadhinlab.com">hello@shadhinlab.com</a>. We will
                    respond to your request within the timeframes required by applicable law.
                </p>

                <h2>9. Data Retention</h2>
                <p>
                    We retain your personal information only for as long as necessary to fulfill
                    the purposes outlined in this Privacy Policy. Specific retention periods include:
                </p>
                <ul>
                    <li><strong>Account Data:</strong> Retained while your account is active and
                    for 30 days after account closure</li>
                    <li><strong>Blocked Domains and Preferences:</strong> Deleted within 30 days
                    of account deletion</li>
                    <li><strong>Usage Analytics:</strong> Aggregated and anonymized data may be
                    retained for up to 2 years for service improvement</li>
                    <li><strong>Payment Records:</strong> Retained as required by tax and accounting
                    regulations (typically 7 years)</li>
                    <li><strong>Support Communications:</strong> Retained for 3 years to provide
                    ongoing customer service</li>
                </ul>
                <p>
                    You may request earlier deletion of your data by contacting us, subject to
                    legal and regulatory requirements.
                </p>

                <h2>10. Children's Privacy</h2>
                <p>
                    <strong>Focusly.pro</strong> is not intended for use by individuals under the
                    age of 13. We do not knowingly collect personal information from children under 13.
                    If we become aware that we have collected such information, we will take
                    steps to delete it promptly. Parents or guardians who believe their child
                    has provided personal information should contact us immediately.
                </p>

                <h2>11. California Privacy Rights</h2>
                <p>
                    If you are a California resident, you have additional rights under the
                    California Consumer Privacy Act (CCPA), including the right to know what
                    personal information we collect, sell, or disclose, and the right to
                    delete personal information. We do not sell personal information to third parties.
                </p>

                <h2>12. European Union Rights</h2>
                <p>
                    If you are in the European Union, you have rights under the General Data
                    Protection Regulation (GDPR), including those listed in Section 8 above.
                    Our lawful basis for processing includes consent, contract performance,
                    and legitimate interests. You also have the right to lodge a complaint
                    with your local data protection authority.
                </p>

                <h2>13. Changes to This Privacy Policy</h2>
                <p>
                    We reserve the right to update or modify this Privacy Policy at any
                    time. If we make material changes, we will notify you through the Plugin
                    interface, email, or other prominent notice at least 30 days before the
                    changes take effect. Your continued use of the Plugin after
                    such changes constitutes your acceptance of the updated Privacy Policy.
                </p>

                <h2>14. Contact Us</h2>
                <p>
                    If you have any questions, concerns, or requests regarding this Privacy Policy
                    or our data practices, please contact us at:
                </p>
                <ul>
                    <li>
                        <strong>Email: </strong>
                        <a href="mailto:hello@shadhinlab.com">hello@shadhinlab.com</a>
                    </li>
                    <li>
                        <strong>Website: </strong>
                        <a href="https://focusly.pro">https://focusly.pro</a>
                    </li>
                </ul>
                <p>
                    We are committed to resolving any privacy concerns you may have and will
                    respond to your inquiries promptly.
                </p>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;