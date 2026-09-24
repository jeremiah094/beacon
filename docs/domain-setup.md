
## Discovery run — 2026-09-24T09:17:36Z

### eas-cli --version
```
eas-cli/24.3.0 linux-x64 node-v22.23.2
```

### eas-cli domains --help
```
★ eas-cli@24.7.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

 ›   Error: Command domains not found.
```

### eas-cli domains:list --help
```
★ eas-cli@24.7.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

 ›   Error: Command domains:list not found.
```

### eas-cli domains:list
```
★ eas-cli@24.7.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

 ›   Error: command domains:list not found
```

### eas-cli domains:configure --help
```
★ eas-cli@24.7.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

 ›   Error: Command domains:configure not found.
```

### eas-cli domains:assign --help
```
★ eas-cli@24.7.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

 ›   Error: Command domains:assign not found.
```

## Discovery run — 2026-09-24T09:18:51Z

### eas-cli --version
```
eas-cli/24.3.0 linux-x64 node-v22.23.2
```

### eas-cli --help (full command list)
```
★ eas-cli@24.7.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

EAS command line tool

VERSION
  eas-cli/24.3.0 linux-x64 node-v22.23.2

USAGE
  $ eas [COMMAND]

TOPICS
  account       manage account
  billing       manage account billing and subscriptions
  branch        manage update branches
  build         build app binaries
  channel       manage update channels
  credentials   manage credentials
  deploy        deploy your Expo Router web build and API Routes
  device        manage Apple devices for Internal Distribution
  env           manage project and account environment variables
  fingerprint   compare fingerprints of the current project, builds, and updates
  integrations  manage third-party service integrations
  metadata      manage store configuration
  observe       monitor app performance metrics
  project       manage project
  submit        submit app binary to App Store and/or Play Store
  testflight    read TestFlight feedback and crashes
  update        manage individual updates
  webhook       manage webhooks
  workflow      manage workflows

COMMANDS
  analytics     display or change analytics settings
  autocomplete  Display autocomplete installation instructions.
  browse        Transition from the terminal to the web browser to view and
                interact with your project on https://expo.dev
  build         start a build
  config        display project configuration (app.json + eas.json)
  credentials   manage credentials
  deploy        deploy your Expo Router web build and API Routes
  diagnostics   display environment info
  help          Display help for eas.
  init          create or link an EAS project
  login         log in with your Expo account
  logout        log out
  new           Create a new project configured with Expo Application Services
                (EAS)
  sim           [EXPERIMENTAL] start a remote simulator session on EAS and get
                instructions to connect to it
  status        show a snapshot of the project: recent builds, dev builds,
                workflow runs, submissions, and updates
  submit        submit app binary to App Store and/or Play Store
  update        publish an update group
  upload        upload a local build and generate a sharable link
  whoami        show the username you are logged in as

```

### commands matching domain/hosting/alias/dns
```
(no matches)
```

### eas-cli deploy --help
```
★ eas-cli@24.7.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

This command is in preview.

deploy your Expo Router web build and API Routes

USAGE
  $ eas deploy [options]
  $ eas deploy --prod
  $ eas deploy --non-interactive --dev-domain my-app

FLAGS
  --alias=name           Custom alias to assign to the new deployment.
  --dev-domain=name      Custom preview URL subdomain to assign to the project
                         on its first deployment, e.g. "my-app" for
                         my-app.expo.app. Required with --non-interactive if you
                         want to customize the preview URL.
  --dry-run              Outputs a tarball of the new deployment instead of
                         uploading it.
  --environment=<value>  Environment variable's environment, e.g. 'production',
                         'preview', 'development'
  --export-dir=dir       [default: dist] Directory where the Expo project was
                         exported.
  --id=xyz123            Custom unique identifier for the new deployment.
  --json                 Enable JSON output, non-JSON messages will be printed
                         to stderr. Implies --non-interactive.
  --non-interactive      Run the command in non-interactive mode.
  --prod                 Create a new production deployment.
  --[no-]source-maps     Include source maps in the deployment.

DESCRIPTION
  deploy your Expo Router web build and API Routes

ALIASES
  $ eas worker:deploy

TOPICS
  deploy:alias  Assign deployment aliases.

COMMANDS
  deploy:alias   Assign deployment aliases.
  deploy:delete  Delete a deployment.

```

### eas-cli project:info --help
```
★ eas-cli@24.7.0 is now available.
To upgrade, run:
npm install -g eas-cli
Proceeding with outdated version.

information about the current project

USAGE
  $ eas project:info

DESCRIPTION
  information about the current project

```

## Verify run — 2026-09-24T09:31:58Z

### A record: beaconproject.eu (expect 172.66.0.241)
```
3.33.130.190
15.197.148.33
172.66.0.241
```

### TXT record: _cf-custom-hostname.beaconproject.eu
```
"419f97c3-d1f2-418e-8cfd-6469dd2c779f"
```

### CNAME record: _acme-challenge.beaconproject.eu
```
beaconproject.eu.7dede208f6a1d738.dcv.cloudflare.com.
```

### HTTPS check: https://beaconproject.eu
```
HTTP 200 in 0.664422s (final URL: https://beaconproject.eu/)
```

## Verify run — 2026-09-24T09:35:56Z

### A record: beaconproject.eu (expect 172.66.0.241)
```
172.66.0.241
```

### TXT record: _cf-custom-hostname.beaconproject.eu
```
"419f97c3-d1f2-418e-8cfd-6469dd2c779f"
```

### CNAME record: _acme-challenge.beaconproject.eu
```
beaconproject.eu.7dede208f6a1d738.dcv.cloudflare.com.
```

### HTTPS check: https://beaconproject.eu
```
HTTP 200 in 0.797711s (final URL: https://beaconproject.eu/)
```

## Verify run — 2026-09-24T09:40:52Z

### A record: beaconproject.eu (expect 172.66.0.241)
```
172.66.0.241
```

### TXT record: _cf-custom-hostname.beaconproject.eu
```
"419f97c3-d1f2-418e-8cfd-6469dd2c779f"
```

### CNAME record: _acme-challenge.beaconproject.eu
```
beaconproject.eu.7dede208f6a1d738.dcv.cloudflare.com.
```

### HTTPS check: https://beaconproject.eu
```
HTTP 200 in 0.056082s (final URL: https://beaconproject.eu/)
```

### A/CNAME record: www.beaconproject.eu
```
beaconproject.eu.
172.66.0.241
```

### HTTPS check: https://www.beaconproject.eu
```
HTTP 308 in 0.148793s (final URL: https://www.beaconproject.eu/)
```

### verbose TLS/HTTP detail for www (to see the actual failure if any)
```
*  start date: Sep 24 08:31:15 2026 GMT
*  expire date: Dec 23 09:31:11 2026 GMT
*  subjectAltName: host "www.beaconproject.eu" matched cert's "*.beaconproject.eu"
*  issuer: C=US; O=Google Trust Services; CN=WE1
*  SSL certificate verify ok.
*   Certificate level 0: Public key type EC/prime256v1 (256/128 Bits/secBits), signed using ecdsa-with-SHA256
*   Certificate level 1: Public key type EC/prime256v1 (256/128 Bits/secBits), signed using ecdsa-with-SHA384
*   Certificate level 2: Public key type EC/secp384r1 (384/192 Bits/secBits), signed using ecdsa-with-SHA384
} [5 bytes data]
* using HTTP/2
* [HTTP/2] [1] OPENED stream for https://www.beaconproject.eu/
* [HTTP/2] [1] [:method: GET]
* [HTTP/2] [1] [:scheme: https]
* [HTTP/2] [1] [:authority: www.beaconproject.eu]
* [HTTP/2] [1] [:path: /]
* [HTTP/2] [1] [user-agent: curl/8.5.0]
* [HTTP/2] [1] [accept: */*]
} [5 bytes data]
> GET / HTTP/2
> Host: www.beaconproject.eu
> User-Agent: curl/8.5.0
> Accept: */*
> 
{ [5 bytes data]
* TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
{ [238 bytes data]
* TLSv1.3 (IN), TLS handshake, Newsession Ticket (4):
{ [238 bytes data]
* old SSL session ID is stale, removing
{ [5 bytes data]
< HTTP/2 308 
< date: Thu, 24 Sep 2026 09:40:53 GMT
< content-length: 0
< location: https://beaconproject.eu/
< strict-transport-security: max-age=31536000; includeSubDomains; preload
< server: cloudflare
< cf-ray: a400d48b2852c99c-IAD
< alt-svc: h3=":443"; ma=86400
< 
* Connection #0 to host www.beaconproject.eu left intact
```
