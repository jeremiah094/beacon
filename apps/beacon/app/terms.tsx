import { LegalPageShell, LegalSection, LegalParagraph } from '../components/LegalPageShell';

// Draft terms of service reflecting what Beacon actually does today. This
// is a reasonable starting point, not a substitute for a real legal
// review — update it (and get it checked) before treating it as final.
export default function TermsOfService() {
  return (
    <LegalPageShell title="Terms of Service" updated="24 September 2026">
      <LegalParagraph>
        These terms cover your use of Beacon (beaconproject.eu and the Beacon app), Ireland's Apex Legends
        league platform. By creating an account, you agree to them.
      </LegalParagraph>

      <LegalSection heading="Your account">
        <LegalParagraph>
          You're responsible for keeping your account credentials secure and for the accuracy of the
          information you provide, including any gaming ID you link. One Beacon account per person — don't
          create multiple accounts to work around league rules.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Fair play">
        <LegalParagraph>
          Linking a gaming ID and letting Beacon read your stats is how we keep results verified rather
          than self-reported. Misrepresenting your identity, rank, or match results, or attempting to
          manipulate standings, may result in results being voided and your account being suspended.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="League administration">
        <LegalParagraph>
          League admins can approve or reject team registrations, publish match results, manage
          substitutions, and — where necessary — remove a team from a league or delete a result. Decisions
          about league eligibility, scheduling, and results sit with the admins running that league.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <LegalParagraph>
          Don't use Beacon to harass other players, attempt to access accounts or data that aren't yours,
          or interfere with the platform's normal operation. We can suspend or remove accounts that break
          these terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Third-party services">
        <LegalParagraph>
          Beacon reads publicly available Apex Legends stats via Electronic Arts' API and, if you choose,
          lets you sign in with Discord. Your use of EA/Apex Legends and Discord themselves is governed by
          their own terms, not ours.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="No warranty">
        <LegalParagraph>
          Beacon is provided as-is. We aim to keep match scheduling, lobby codes, and results accurate and
          available, but we don't guarantee the service will be uninterrupted or error-free.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <LegalParagraph>
          If we make material changes, we'll update the date at the top of this page. Continuing to use
          Beacon after a change means you accept the updated terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Contact us">
        <LegalParagraph>Questions about these terms? Email admin@beaconproject.eu.</LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  );
}
