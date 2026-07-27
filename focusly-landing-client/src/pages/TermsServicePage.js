import React, {useEffect} from 'react';

const TermsServicePage = () => {
    useEffect(() => {
        document.title = "Terms of Service - Focusly";
        // scroll to top
        window.scrollTo(0, 0);
    }, []);
    return (
        <div className="terms-of-service-main">
            <div className="container">
                <h1>Terms of Service</h1>
                <p><strong>Last Updated:</strong> 18 Aug, 2025</p>

                <p>
                    Welcome to <strong>Focusly.pro</strong> ("we," "our," or "us"). These Terms of Service 
                    ("Terms") govern your use of our website blocking and productivity Chrome extension 
                    and web application (collectively, the "Service"). By accessing or using our Service, 
                    you agree to be bound by these Terms.
                </p>

                <h2>1. Acceptance of Terms</h2>
                <p>
                    By creating an account, downloading, installing, or using Focusly.pro, you acknowledge 
                    that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. 
                    If you do not agree to these Terms, do not use our Service.
                </p>

                <h2>2. Description of Service</h2>
                <p>
                    Focusly.pro is a productivity tool that provides website blocking functionality through 
                    a Chrome browser extension and web application. Our Service includes:
                </p>
                <ul>
                    <li><strong>Website Blocking:</strong> Instant and scheduled blocking of specified websites</li>
                    <li><strong>Time Management:</strong> Configurable time limits and usage tracking</li>
                    <li><strong>Analytics:</strong> Daily usage reports and productivity insights</li>
                    <li><strong>Customization:</strong> Custom backgrounds, messages, and preferences</li>
                    <li><strong>Calendar Integration:</strong> Scheduling blocks through calendar connectivity</li>
                    <li><strong>Cross-Device Sync:</strong> Cloud synchronization of settings and data</li>
                    <li><strong>Premium Features:</strong> Advanced functionality available through subscription</li>
                </ul>

                <h2>3. User Accounts and Registration</h2>
                
                <h3>3.1. Account Creation</h3>
                <p>
                    To use certain features of our Service, you must create an account by providing 
                    accurate and complete information, including a valid email address. You are 
                    responsible for maintaining the confidentiality of your account credentials.
                </p>

                <h3>3.2. Account Responsibility</h3>
                <p>
                    You are solely responsible for all activities that occur under your account. 
                    You must immediately notify us of any unauthorized use of your account or 
                    any other breach of security.
                </p>

                <h3>3.3. Account Termination</h3>
                <p>
                    You may terminate your account at any time by contacting us. We may suspend 
                    or terminate your account if you violate these Terms or engage in prohibited activities.
                </p>

                <h2>4. Subscription and Payment Terms</h2>

                <h3>4.1. Free Trial</h3>
                <p>
                    We offer a 6-month free subscription that provides access to all premium features. 
                    No payment information is required during the trial period. The trial automatically 
                    expires after 6 months unless you subscribe to a paid plan.
                </p>

                <h3>4.2. Premium Subscription</h3>
                <p>
                    After the free trial, continued access to premium features requires a paid subscription. 
                    Subscription fees are charged annually in advance and are non-refundable except as 
                    required by law.
                </p>

                <h3>4.3. Payment Processing</h3>
                <p>
                    Payments are processed through secure third-party payment processors. By providing 
                    payment information, you authorize us to charge the applicable fees to your chosen 
                    payment method.
                </p>

                <h3>4.4. Price Changes</h3>
                <p>
                    We reserve the right to modify subscription prices with at least 30 days' notice. 
                    Price changes will not affect your current subscription period but will apply to 
                    subsequent renewals.
                </p>

                <h3>4.5. Automatic Renewal</h3>
                <p>
                    Subscriptions automatically renew for successive periods of the same duration unless 
                    you cancel before the renewal date. You can cancel your subscription at any time 
                    through your account settings.
                </p>

                <h2>5. Acceptable Use Policy</h2>
                
                <h3>5.1. Permitted Use</h3>
                <p>
                    You may use our Service only for lawful purposes and in accordance with these Terms. 
                    The Service is intended for personal productivity and website blocking.
                </p>

                <h3>5.2. Prohibited Activities</h3>
                <p>You agree not to:</p>
                <ul>
                    <li>Use the Service for any illegal or unauthorized purpose</li>
                    <li>Circumvent, disable, or interfere with security features of the Service</li>
                    <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                    <li>Use automated systems to access the Service without permission</li>
                    <li>Share your account credentials with others</li>
                    <li>Upload malicious content or attempt to harm our infrastructure</li>
                    <li>Violate any applicable laws or regulations while using the Service</li>
                    <li>Use the Service to block access to emergency services or critical safety information</li>
                </ul>

                <h2>6. User Content and Data</h2>

                <h3>6.1. Your Content</h3>
                <p>
                    You retain ownership of any content you upload or create using our Service, including 
                    custom backgrounds, messages, and blocked website lists. You grant us a limited license 
                    to use this content solely to provide the Service to you.
                </p>

                <h3>6.2. Content Responsibility</h3>
                <p>
                    You are solely responsible for your content and must ensure it complies with applicable 
                    laws and these Terms. We are not responsible for any content you upload or create.
                </p>

                <h3>6.3. Data Backup</h3>
                <p>
                    While we maintain regular backups, you are responsible for maintaining your own backups 
                    of important data. We recommend exporting your settings and blocked website lists regularly.
                </p>

                <h2>7. Privacy and Data Protection</h2>
                <p>
                    Your privacy is important to us. Our collection, use, and protection of your personal 
                    information is governed by our Privacy Policy, which is incorporated into these Terms 
                    by reference. By using our Service, you consent to the collection and use of your 
                    information as described in our Privacy Policy.
                </p>

                <h2>8. Intellectual Property Rights</h2>

                <h3>8.1. Our Rights</h3>
                <p>
                    The Service, including all content, features, and functionality, is owned by us and 
                    protected by copyright, trademark, and other intellectual property laws. You are 
                    granted a limited, non-exclusive, non-transferable license to use the Service.
                </p>

                <h3>8.2. Trademark Policy</h3>
                <p>
                    "Focusly" and our logos are trademarks owned by us. You may not use our trademarks 
                    without our prior written permission.
                </p>

                <h3>8.3. Third-Party Rights</h3>
                <p>
                    We respect the intellectual property rights of others and expect users to do the same. 
                    If you believe your intellectual property rights have been violated, please contact us.
                </p>

                <h2>9. Service Availability and Modifications</h2>

                <h3>9.1. Service Availability</h3>
                <p>
                    We strive to maintain high service availability but cannot guarantee uninterrupted access. 
                    The Service may be temporarily unavailable due to maintenance, updates, or technical issues.
                </p>

                <h3>9.2. Service Modifications</h3>
                <p>
                    We reserve the right to modify, suspend, or discontinue any part of the Service at any 
                    time with reasonable notice. We will provide at least 30 days' notice for significant 
                    changes that materially affect functionality.
                </p>

                <h3>9.3. Updates and Upgrades</h3>
                <p>
                    We may release updates to improve the Service. Some updates may be automatically installed, 
                    while others may require your action. Continued use of the Service constitutes acceptance 
                    of updates.
                </p>

                <h2>10. Third-Party Services and Integrations</h2>
                <p>
                    Our Service may integrate with third-party services such as calendar applications. 
                    These integrations are subject to the terms and policies of the respective third parties. 
                    We are not responsible for the availability, functionality, or policies of third-party services.
                </p>

                <h2>11. Disclaimers and Limitations</h2>

                <h3>11.1. Service Disclaimer</h3>
                <p>
                    THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                    EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS 
                    FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>

                <h3>11.2. Blocking Effectiveness</h3>
                <p>
                    While our Service is designed to block access to specified websites, we cannot guarantee 
                    100% effectiveness. Determined users may find ways to circumvent blocking measures. 
                    The Service is a productivity tool and should not be relied upon for critical security purposes.
                </p>

                <h3>11.3. Data Loss</h3>
                <p>
                    We are not liable for any loss of data, including blocked website lists, custom settings, 
                    or usage statistics, regardless of cause.
                </p>

                <h2>12. Limitation of Liability</h2>
                <p>
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                    INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS 
                    OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, 
                    GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
                </p>
                <p>
                    OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING TO THE SERVICE 
                    SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
                </p>

                <h2>13. Indemnification</h2>
                <p>
                    You agree to defend, indemnify, and hold us harmless from and against any claims, 
                    damages, obligations, losses, liabilities, costs, and expenses (including attorney's fees) 
                    arising from your use of the Service, violation of these Terms, or infringement of 
                    any rights of another party.
                </p>

                <h2>14. Governing Law and Dispute Resolution</h2>

                <h3>14.1. Governing Law</h3>
                <p>
                    These Terms are governed by and construed in accordance with the laws of [Your Jurisdiction], 
                    without regard to conflict of law principles.
                </p>

                <h3>14.2. Dispute Resolution</h3>
                <p>
                    Any disputes arising from these Terms or the Service shall be resolved through binding 
                    arbitration in accordance with the rules of [Arbitration Organization]. The arbitration 
                    shall be conducted in [Location] and judgment may be entered on the arbitral award in 
                    any court of competent jurisdiction.
                </p>

                <h3>14.3. Class Action Waiver</h3>
                <p>
                    You agree that any dispute resolution proceedings will be conducted only on an individual 
                    basis and not in a class, consolidated, or representative action.
                </p>

                <h2>15. Export Compliance</h2>
                <p>
                    The Service may be subject to export control laws and regulations. You agree to comply 
                    with all applicable export and import laws and shall not export, re-export, or transfer 
                    the Service to any prohibited country or person.
                </p>

                <h2>16. Severability</h2>
                <p>
                    If any provision of these Terms is found to be unenforceable or invalid, the remaining 
                    provisions will remain in full force and effect. The unenforceable provision will be 
                    modified to the minimum extent necessary to make it enforceable.
                </p>

                <h2>17. Entire Agreement</h2>
                <p>
                    These Terms, together with our Privacy Policy, constitute the entire agreement between 
                    you and us regarding the Service and supersede all prior agreements and understandings.
                </p>

                <h2>18. Changes to Terms</h2>
                <p>
                    We reserve the right to modify these Terms at any time. We will notify you of material 
                    changes by email or through the Service interface at least 30 days before the changes 
                    take effect. Your continued use of the Service after the changes become effective 
                    constitutes acceptance of the modified Terms.
                </p>

                <h2>19. Contact Information</h2>
                <p>
                    If you have any questions about these Terms or the Service, please contact us at:
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
                    <strong>Acknowledgment:</strong> By using Focusly.pro, you acknowledge that you have 
                    read these Terms of Service and agree to be bound by them.
                </p>
            </div>
        </div>
    );
};

export default TermsServicePage;