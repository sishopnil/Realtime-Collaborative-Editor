# API Versioning & Compatibility

- Current API is tagged as `v1` (implicit). Future breaking changes will use header or path versioning.

Strategies
- Header: `x-api-version: 1` (preferred for internal clients)
- URL prefix: `/api/v1/*` (externally visible)
- Sunset headers for deprecated endpoints; provide migration guides.

Compatibility
- Additive changes (new fields/endpoints) do not bump major version.
- Breaking changes require deprecation period and two releases notice.
