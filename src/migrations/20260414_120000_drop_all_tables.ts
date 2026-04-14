/**
 * Full database reset (same idea as `pnpm payload migrate:fresh`’s drop step).
 * Mirrors `@payloadcms/drizzle/sqlite/dropDatabase`: `client.execute` for the table list, then
 * `client.executeMultiple` for one PRAGMA + DROP script — not Drizzle `db.batch` (avoids D1 HTTP issues).
 *
 * Omits `_cf_*` D1-internal tables (HTTP API returns SQLITE_AUTH if you try to drop them).
 * Drops views first.
 *
 * @see https://payloadcms.com/docs/database/migrations
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite/types'

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

type LibsqlShim = {
  execute: (sql: string) => Promise<{ rows: { name: string }[] }>
  executeMultiple: (sql: string) => Promise<void>
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const client = (payload.db as unknown as { client: LibsqlShim }).client

  for (let pass = 0; pass < 32; pass++) {
    const { rows: views } = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type = 'view' AND name NOT LIKE 'sqlite_%'
    `)
    if (!views?.length) break
    for (const { name } of views) {
      await client.executeMultiple(`DROP VIEW IF EXISTS ${quoteIdent(name)};`)
    }
  }

  const { rows } = await client.execute(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '_cf_%'
  `)

  if (!rows?.length) {
    return
  }

  const multi = `
PRAGMA foreign_keys = OFF;
${rows.map(({ name }) => `DROP TABLE IF EXISTS ${name}`).join(';\n')};
PRAGMA foreign_keys = ON;`

  await client.executeMultiple(multi)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Irreversible.
}
