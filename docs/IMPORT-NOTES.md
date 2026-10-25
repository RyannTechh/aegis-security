# Import notes

All application JavaScript, package manifests, and image assets were retained. The original README is preserved in ORIGINAL-README.md.

## Changes

- Moved root images into assets/; identical duplicates are stored once.
- Updated shared branding to load its logo from assets/ and use Aegis Security in its footer.
- Updated package metadata and added the exact user-provided bio.
- Added setup documentation, command inventory, a sanitized environment template, Git exclusions, formatting defaults, and a syntax check command.
- Kept command, service, event, handler, and database module paths intact.

## Exclusions

.env (credentials), SQLite database/WAL/SHM (live records), .npm and .cache (dependencies and logs), and .commands-deployed (runtime marker) remain in the unchanged original archive. They are not published in this source repository.

Existing SALRP/Miami assets, community messages, legacy environment names, and protocol identifiers remain compatible. Bot behavior has not otherwise been refactored. This is a source distribution, not a copy of the running deployment.
