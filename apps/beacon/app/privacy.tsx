import { LegalPageShell, LegalSection, LegalParagraph } from '../components/LegalPageShell';

// Draft privacy policy reflecting what Beacon actually does today. This is
// a reasonable starting point, not a substitute for a real legal review —
// update it (and get it checked) before treating it as compliance-ready.
export default function PrivacyPolicy() {
  return (
    <LegalPageShell title="Privacy Policy" updated="24 September 2026">
      <LegalParagraph>
        Beacon ("we", "us") runs Ireland's Apex Legends league at beaconproject.eu and through the Beacon
        app. This policy explains what information we collect from players, team captains and league
        admins, why we collect it, and the choices you have.
      </LegalParagraph>

      <LegalSection heading="Information we collect">
        <LegalParagraph>
          Account details — your email address and password (stored securely, never in plain text), or
          your Discord account ID, username and email if you sign in with Discord instead.
        </LegalParagraph>
        <LegalParagraph>
          Profile information — a display name and gamertag you choose.
        </LegalParagraph>
        <LegalParagraph>
          Linked EA/Apex Legends account — if you link a gaming ID, we read publicly available stats from
          it (rank, K/D, wins, legend usage) to verify your identity and eligibility. We never receive your
          EA password or post anything to your EA/Apex account.
        </LegalParagraph>
        <LegalParagraph>
          League activity — the teams you belong to, lineups you submit, substitution requests, and match
          results entered by league admins (placements and kills for each game you play).
        </LegalParagraph>
        <LegalParagraph>
          Push notification tokens — only if you enable notifications, so we can send match reminders and
          lobby codes to your device.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="How we use it">
        <LegalParagraph>
          To run the league you've signed up for: verifying eligibility, organising lineups and lobbies,
          publishing results and standings, and letting league admins manage teams fairly. We also use it
          to prevent fraud (e.g. someone else's stats being claimed as your own) and to send you
          match-related notifications you've opted into.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Who we share it with">
        <LegalParagraph>
          Supabase, our database and authentication provider, hosts your account and league data in the
          EU (Ireland). Discord, only if you choose to sign in with Discord. Expo/EAS, who deliver push
          notifications and host the app. Electronic Arts' public Apex Legends stats API, read-only, only
          for the gaming ID you link. We don't sell your data or share it with advertisers.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <LegalParagraph>
          We keep your account and league history for as long as your account is active. If you ask us to
          delete your account, we'll remove your personal information within a reasonable time, except
          where we need to keep match results for the integrity of a league's historical standings — in
          that case we'll anonymise your identity from the record rather than keep it linked to you.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Your rights">
        <LegalParagraph>
          Under GDPR, you can ask us to access, correct, delete, or export your personal data, or object to
          how we use it. Contact us using the details below, or, if you're not satisfied with our response,
          you can complain to Ireland's Data Protection Commission (dataprotection.ie).
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Security">
        <LegalParagraph>
          Passwords are stored using industry-standard hashing, never in plain text. Access to league and
          admin data is restricted by row-level security rules enforced at the database level, not just in
          the app.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Cookies and local storage">
        <LegalParagraph>
          The web app stores your sign-in session in your browser's local storage so you stay signed in
          between visits. We don't use advertising or tracking cookies.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <LegalParagraph>
          If we make material changes to this policy, we'll update the date at the top of this page.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Contact us">
        <LegalParagraph>Questions about this policy or your data? Email admin@beaconproject.eu.</LegalParagraph>
      </LegalSection>
    </LegalPageShell>
  );
}
