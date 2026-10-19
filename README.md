# Creative Minds Network

Creative Minds Network is a modern learning and assessment hub built for students, teachers, and program administrators. The project combines classroom resources, assessments, interactive practice, and member access tools into one polished web experience.

This repository includes the public-facing platform, learning resources, and supporting configuration for deployment and member-only features.

## Overview

Creative Minds Network supports a wide range of educational experiences:

- Ready-to-use classroom assignments and teacher resources
- Kid Program content for grades 5–12
- TOEFL Junior-style speaking, listening, and writing practice packs
- Browser-based learning games and skill-building activities
- Daily student assessment workflows and linked resource hubs
- Member-only assessment access with Supabase-backed authentication and entitlements

## Highlights

### Classroom resources

- Printable and downloadable student materials
- Teacher answer keys and rubric support
- Assignment previews with student and teacher views
- Print-ready activity pages for classroom use

### Kid Program

- Grade-based navigation for grades 5 through 12
- Dedicated program hubs and external resource links
- Grade-specific learning pathways and classroom material handoff

### TOEFL Junior-style assessments

- Original speaking, listening, and writing packs
- Skill-by-skill filters and organized assessment library
- Teacher guidance, suggested responses, and rubric-based scoring
- On-device listening playback for classroom and practice use

### Learning games

- Interactive browser games for skill practice
- Game catalog with challenge descriptions and feedback loops
- Standalone game experiences for classroom engagement

### Member experience

- Supabase-powered member access and verification flow
- Restricted assessment access for confirmed, entitled users
- Secure lead capture workflow and account-related server-side handling
- Private question-bank configuration for protected mini mock content

## Tech stack

- React
- Vite
- TypeScript
- Tailwind CSS
- HTML/CSS
- Supabase
- PostgreSQL

## Project structure

```text
.
├── src/
│   ├── components/
│   ├── data/
│   ├── hooks/
│   ├── pages/
│   └── styles/
├── supabase/
│   ├── functions/
│   ├── migrations/
│   └── tests/
├── public/
├── .github/workflows/
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── README.md
├── .env.example
└── .gitignore
```

## Local development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npx vitest run --config vitest.config.ts
npm run build
npm run preview
```

## Deployment

The project is designed for GitHub Pages deployment and includes workflow support for automated publishing.

### Recommended setup

1. Push the repository to GitHub.
2. In GitHub repository settings, enable GitHub Pages using GitHub Actions.
3. Deploy from the repository workflow.

The app is configured to build for static hosting and supports project-path deployment patterns typical of GitHub Pages.

## Supabase and member access

Member-only features require a Supabase project and secure configuration. Sensitive data, question banks, and privileged secrets must not be committed to the public repository.

Recommended setup:

- Configure email verification in Supabase Auth
- Set browser-safe environment variables for the public app
- Keep private assessment content and jobs in Supabase Edge Functions and secrets
- Protect member-only functions with verification and policy enforcement

## Privacy and security notes

This project includes educational and member-access features, which means privacy and data practices should be reviewed before production use. In particular:

- Ensure proper consent flows for lead capture
- Review RLS and access policies for member data
- Keep private content out of client-side environment variables
- Validate deployment and storage settings before live student use

## Notes

- The site includes browser-based games and interactive classroom materials.
- Student-facing simulations are educational tools and are not connected to external LMS or AI systems.
- Public deployment should be accompanied by an internal review of privacy, compliance, and operator contact details before use with real student data.

## License

This project is licensed under the Apache License 2.0.

## Contributing

Contributions are welcome for improvements to learning content, UI experience, security hardening, deployment configuration, and classroom functionality.

If you are working on a feature or fix, keep changes scoped, document new functionality, and validate the build where possible.
