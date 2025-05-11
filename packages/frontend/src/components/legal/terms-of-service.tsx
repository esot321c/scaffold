export function TermsOfService() {
  const currentDate = new Date();
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(currentDate);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Terms of Service</h2>
        <p className="text-sm text-muted-foreground">
          Last updated: {formattedDate}
        </p>
      </div>
      <div className="prose prose-stone dark:prose-invert max-w-none">
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Scaffold, you agree to be bound by these Terms
            of Service and all applicable laws and regulations. If you do not
            agree with any of these terms, you are prohibited from using or
            accessing this service.
          </p>
        </section>

        <section>
          <h2>2. Use License</h2>
          <p>
            Permission is granted to temporarily use Scaffold for personal,
            non-commercial transitory viewing only. This is the grant of a
            license, not a transfer of title, and under this license you may
            not:
          </p>
          <ul>
            <li>modify or copy the materials;</li>
            <li>use the materials for any commercial purpose;</li>
            <li>
              attempt to decompile or reverse engineer any software contained in
              Scaffold;
            </li>
            <li>
              remove any copyright or other proprietary notations from the
              materials; or
            </li>
            <li>
              transfer the materials to another person or "mirror" the materials
              on any other server.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Account Terms</h2>
          <p>
            To access certain features of Scaffold, you may be required to
            create an account. You agree to:
          </p>
          <ul>
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain the security of your account and password</li>
            <li>
              Accept responsibility for all activities that occur under your
              account
            </li>
            <li>
              Notify us immediately of any unauthorized use of your account
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Service Modifications</h2>
          <p>We reserve the right at any time to:</p>
          <ul>
            <li>
              Modify or discontinue, temporarily or permanently, the service (or
              any part thereof) with or without notice
            </li>
            <li>Change the pricing of our services with reasonable notice</li>
            <li>
              Limit features or functionality to certain user types or
              subscription levels
            </li>
          </ul>
          <p>
            We shall not be liable to you or any third party for any
            modification, suspension, or discontinuance of the service.
          </p>
        </section>

        <section>
          <h2>5. Limitations</h2>
          <p>
            In no event shall Scaffold be liable for any damages arising out of
            the use or inability to use the materials on Scaffold, even if we
            have been notified of the possibility of such damage.
          </p>
        </section>

        <section>
          <h2>6. Governing Law</h2>
          <p>
            These terms and conditions are governed by and construed in
            accordance with the laws, and any disputes relating to these terms
            and conditions will be subject to the exclusive jurisdiction of the
            courts.
          </p>
        </section>

        <section>
          <h2>7. Changes to Terms</h2>
          <p>
            We reserve the right to revise these terms of service at any time
            without notice. By using Scaffold, you are agreeing to be bound by
            the then current version of these terms of service.
          </p>
        </section>

        <section>
          <h2>8. Contact Information</h2>
          <p>
            If you have any questions about these Terms of Service, please
            contact us at:
          </p>
          <p>Email: terms@example.com</p>
        </section>
      </div>
    </div>
  );
}
