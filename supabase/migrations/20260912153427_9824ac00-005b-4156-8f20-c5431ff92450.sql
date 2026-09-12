-- The app requires login for every page, so anonymous users need no table access.
-- This also removes anon visibility of all tables from the GraphQL schema (lint 0026).
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;