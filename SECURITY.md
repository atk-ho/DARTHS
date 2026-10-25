# Security Policy

Thank you for helping keep **DARTHS** and its users safe.

DARTHS is a browser-based darts scoreboard and tournament application with optional live spectator features powered by Firebase.

## Supported Versions

Security fixes are prioritized for the latest version deployed from the project's main branch. Older releases may not receive security updates.

| Version | Security updates |
| --- | --- |
| Latest release / `main` | Supported |
| Older releases | Not guaranteed |

## Reporting a Vulnerability

**Please do not publicly disclose a suspected vulnerability before it has been reviewed.**

If the GitHub repository has **Private vulnerability reporting** enabled, use its **Security → Report a vulnerability** option. Otherwise, contact the repository maintainer through a private contact method listed on the repository profile. **Do not open a public issue containing exploit details, credentials, private data, or working attack code.**

When reporting, please include:

- A short description of the issue and its potential impact.
- The affected page, feature, version, or commit.
- Steps to reproduce, including relevant browser or device details.
- A minimal proof of concept, if safe to share.
- Suggested mitigation, if known.

Please redact access tokens, credentials, personal information, and any other secrets from reports.

There is currently **no guaranteed response or resolution timeframe**. The maintainer will review reports as availability permits and may request further details.

## Security Scope

Reports are particularly helpful for issues involving:

- Firebase Authentication and Realtime Database access rules.
- Unauthorized modification of live matches, tournament brackets, or spectator data.
- Cross-site scripting (XSS), unsafe HTML injection, and malicious input handling.
- Exposure of private information or sensitive application data.
- Dependency or service-worker vulnerabilities that could affect users.

A Firebase web configuration object is not, by itself, a secret; access must be protected through appropriate Authentication and Database Security Rules. **Never commit service-account credentials, private keys, or other secrets.**

## Safe Testing

Only test accounts, matches, and data you own or have explicit permission to use. Avoid disrupting live games, accessing other users' information, or performing denial-of-service testing.

## Updates and Disclosure

Confirmed issues may be addressed through code changes, dependency updates, Firebase rule changes, or configuration guidance. Once a fix is available, the maintainer may publish release notes or a security advisory when appropriate.

## Disclaimer

DARTHS is provided **as is**, without a guarantee that it is free from vulnerabilities. Users who self-host the application are responsible for securing their own Firebase projects, hosting settings, and deployment credentials.
