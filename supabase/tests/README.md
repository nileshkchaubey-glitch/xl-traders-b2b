# Authorization tests

Run `npm run test:authorization` (also part of `npm run ci` and GitHub CI).
It runs actual PostgreSQL/pgTAP in ephemeral PGlite memory. No Docker, database
credentials, remote connection, paid service or database deployment is involved.

The runner creates the explicitly limited pre-audit fixture in
`supabase/test-fixtures/authorization-baseline.sql`, proves the original security
holes fail the role assertions, then starts a fresh database, applies the checked-in
authorization migration twice, and requires the full suite to pass. The suite
rolls back its data. A TAP failure, incomplete plan or unexpected SQL error fails CI.

Coverage: anonymous/customer/admin roles, malicious signup and upsert, ordinary
profile edits, profile ownership, privileged flags, settings and import-log CRUD,
public settings reads, and published/draft/inactive health-view visibility.

This fixture reproduces the audited authorization boundary; it is **not** a full
production schema export and does not certify the hosted database's current grants,
Auth service, other migrations, concurrency, or application login. The same pgTAP
SQL can be run against a disposable full-schema Supabase environment with
`supabase test db supabase/tests/authorization_security_roles_test.sql --db-url <test-url>`.
Never run the fixture against a hosted project. Production migrations require
separate owner approval; adding this runner deploys no SQL.
