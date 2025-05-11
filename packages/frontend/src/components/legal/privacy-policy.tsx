export function PrivacyPolicy() {
  const currentDate = new Date();
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(currentDate);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Privacy Policy</h2>
        <p className="text-sm text-muted-foreground">
          Last updated: {formattedDate}
        </p>
      </div>

      <div className="prose prose-stone dark:prose-invert max-w-none">
        <section>
          <h2>1. Introduction</h2>
          <p>
            Welcome to Scaffold ("we," "our," or "us"). We respect your privacy
            and are committed to protecting your personal data. This privacy
            policy explains how we collect, use, and safeguard your information
            when you use our application.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>

          <h3>2.1 Account Information</h3>
          <p>
            When you register, we collect information such as your name, email
            address, and profile information provided through authentication
            services like Google.
          </p>

          <h3>2.2 Device Information</h3>
          <p>
            We collect information about devices used to access your account,
            including:
          </p>
          <ul>
            <li>Device type and operating system</li>
            <li>Browser type</li>
            <li>IP address</li>
            <li>Device identifiers</li>
          </ul>
          <p>
            This information helps us identify and display your active devices,
            allowing you to manage access to your account.
          </p>

          <h3>2.3 Session Information</h3>
          <p>We track your active login sessions, including:</p>
          <ul>
            <li>Login dates and times</li>
            <li>IP addresses used for access</li>
            <li>Session duration and activity</li>
          </ul>

          <h3>2.4 Security and Activity Logs</h3>
          <p>
            We maintain security logs of activities related to your account,
            such as:
          </p>
          <ul>
            <li>Login attempts (successful and failed)</li>
            <li>Password changes</li>
            <li>Device trust status changes</li>
            <li>Account setting modifications</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>

          <h3>3.1 Service Provision</h3>
          <p>We use your information to:</p>
          <ul>
            <li>Authenticate your identity</li>
            <li>Provide access to your account</li>
            <li>Maintain and improve our services</li>
            <li>Respond to your requests and support needs</li>
          </ul>

          <h3>3.2 Security</h3>
          <p>We use device and session information to:</p>
          <ul>
            <li>Protect your account from unauthorized access</li>
            <li>Detect and prevent fraud</li>
            <li>
              Enable you to review and manage your active sessions and trusted
              devices
            </li>
            <li>Notify you of suspicious activity</li>
          </ul>

          <h3>3.3 Service Improvement</h3>
          <p>We analyze usage patterns to:</p>
          <ul>
            <li>Understand how our services are used</li>
            <li>Troubleshoot technical issues</li>
            <li>Develop new features and improvements</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Retention</h2>
          <p>We retain different types of data for varying periods:</p>
          <ul>
            <li>
              <strong>Account information:</strong> Retained as long as your
              account is active
            </li>
            <li>
              <strong>Security logs:</strong> Typically retained for 90 days
            </li>
            <li>
              <strong>Session data:</strong> Active until you log out or they
              expire (typically 7 days)
            </li>
            <li>
              <strong>Device information:</strong> Retained until you remove a
              device from your account
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Your Rights and Controls</h2>
          <p>You have several rights and controls regarding your data:</p>
          <ul>
            <li>
              <strong>Access and View:</strong> You can view your active
              sessions and devices in your account settings
            </li>
            <li>
              <strong>Control:</strong> You can log out of active sessions and
              remove trusted devices
            </li>
            <li>
              <strong>Data Requests:</strong> You can request a copy of your
              personal data we hold
            </li>
            <li>
              <strong>Account Deletion:</strong> You can request account
              deletion, which will remove your personal information
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share data in
            limited circumstances:
          </p>
          <ul>
            <li>
              <strong>Service Providers:</strong> With vendors who help us
              provide services (always with appropriate data protection
              agreements)
            </li>
            <li>
              <strong>Legal Requirements:</strong> When required by applicable
              law, legal process, or government requests
            </li>
            <li>
              <strong>Business Transfers:</strong> In connection with a merger,
              acquisition, or sale of assets
            </li>
          </ul>
        </section>

        <section>
          <h2>7. Security</h2>
          <p>
            We implement appropriate technical and organizational measures to
            protect your personal data, including:
          </p>
          <ul>
            <li>Encryption of data in transit and at rest</li>
            <li>Regular security assessments</li>
            <li>Access controls and authentication procedures</li>
            <li>Monitoring for suspicious activity</li>
          </ul>
          <p>
            No method of transmission or storage is 100% secure, but we strive
            to protect your information using industry best practices.
          </p>
        </section>

        <section>
          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify
            you of any changes by posting the new policy on this page and
            updating the "Last updated" date. For significant changes, we may
            provide additional notice such as an email notification.
          </p>
        </section>

        <section className="mb-0">
          <h2>9. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or our privacy
            practices, please contact us at:
          </p>
          <p>Email: privacy@example.com</p>
        </section>
      </div>
    </div>
  );
}
