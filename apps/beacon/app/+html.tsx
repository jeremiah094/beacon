import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const SITE_URL = 'https://beaconproject.eu';
const SITE_NAME = 'Beacon';
const DEFAULT_TITLE = 'Beacon — Ireland’s Esports League Platform';
const DEFAULT_DESCRIPTION =
  'Beacon runs competitive Apex Legends and Valorant leagues in Ireland — team registration, lineup management, live match monitoring and EA/Riot-verified standings, all in one app.';

// Expo Router's static web export wraps every pre-rendered route in this
// document shell once at build time (not per-route — individual screens
// override <title>/<meta description> on top of this via expo-router/head,
// see LandingPage.tsx). Metadata needs to live in the raw HTML, not just
// get set client-side after hydration, so that crawlers and link-preview
// bots that don't run JS (most of them, still, in practice) see a real
// title/description/OG image instead of Beacon's loading spinner.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en-IE">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#101114" />
        <meta name="robots" content="index, follow" />

        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <link rel="canonical" href={SITE_URL} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content={DEFAULT_TITLE} />
        <meta property="og:description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:image" content={`${SITE_URL}/icon.png`} />
        <meta property="og:locale" content="en_IE" />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={DEFAULT_TITLE} />
        <meta name="twitter:description" content={DEFAULT_DESCRIPTION} />
        <meta name="twitter:image" content={`${SITE_URL}/icon.png`} />

        {/* SportsOrganization schema — the structured-data hook Google uses
            for a knowledge-panel-style result and for understanding that
            this is a sports/esports org serving Ireland, not a generic
            app marketing page. */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsOrganization',
              name: SITE_NAME,
              url: SITE_URL,
              logo: `${SITE_URL}/icon.png`,
              description: DEFAULT_DESCRIPTION,
              sport: ['Apex Legends', 'Valorant'],
              areaServed: {
                '@type': 'Country',
                name: 'Ireland',
              },
            }),
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
