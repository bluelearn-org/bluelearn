# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in BLUE, please
report it privately. **Do not open a public GitHub issue.**

Preferred channels (in order):

1. **GitHub private vulnerability reporting** — open a report at
  [[https://github.com/The-B-L-U-E-Project/blue-prototype/security/advisories/new]([https://github.com/The-B-L-U-E-Project/blue-prototype/security/advisories/new](https://github.com/bluelearn-org/Bluelearn/security/advisories/new))](https://github.com/bluelearn-org/Bluelearn/security/advisories/new)
   (replace with the real path once the repo is public).
2. **Email:** `lam.tony540@gmail.com`. 

Please include:

- A clear description of the issue and its impact.
- Steps to reproduce, ideally with a minimal proof of concept.
- The affected version, branch, or commit.
- Your name / handle if you'd like credit in the advisory.

## What to expect

- **Acknowledgement:** within 3 business days.
- **Initial assessment:** within 10 business days.
- **Fix and disclosure timeline:** depends on severity and complexity.
We aim for coordinated disclosure: a fix and public advisory together,
with credit to the reporter unless you ask to remain anonymous.

We will not pursue legal action against good-faith researchers who:

- Report privately and give us a reasonable chance to remediate before
public disclosure.
- Avoid privacy violations, service degradation, and destruction of
data.
- Do not exfiltrate user data beyond the minimum needed to demonstrate
the issue.

## Scope

In scope:

- The BLUE web application (`app/`).
- The BLUE API service (`api/`).
- Database schema, RLS policies, and auth flows (`supabase/`).
- Build and deployment configuration in this repository.

Out of scope (please do not test):

- Third-party services BLUE depends on (Supabase, hosting providers,
CDN). Report those upstream.
- Denial-of-service against production infrastructure.
- Social engineering of contributors, maintainers, or users.
- Physical attacks.

