#!/usr/bin/env node
import { Command } from 'commander';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { MigrationRunner } from './libs/MigrationRunner';
import type { DatabaseClient } from './libs/MigrationStore';
import { DatabaseUrlRequiredProblem } from './libs/problems/DatabaseUrlRequiredProblem';
import { UnsupportedDialectProblem } from './libs/problems/UnsupportedDialectProblem';

const program = new Command();

program.name('migrate').description('Drizzle migration runner').version('0.1.0');

program
  .command('up')
  .description('Run pending migrations')
  .option('-d, --dir <path>', 'migrations directory', './migrations')
  .option('-t, --target <id>', 'target migration ID')
  .option('-c, --connection <url>', 'database connection URL')
  .option('--table <name>', 'migrations table name', '_migrations')
  .option('--dialect <dialect>', 'database dialect (postgres, sqlite, mysql)', 'postgres')
  .action(async (options) => {
    try {
      const db = await createDbClient(options.connection, options.dialect);
      const runner = new MigrationRunner(db, options.dir, options.table);

      const executed = await runner.up(options.target);

      if (executed.length === 0) {
        console.log('No pending migrations');
      } else {
        console.log(`Executed ${executed.length} migration(s):`);
        for (const id of executed) {
          console.log(`  ✓ ${id}`);
        }
      }

      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('down')
  .description('Revert migrations')
  .option('-d, --dir <path>', 'migrations directory', './migrations')
  .option('-t, --target <id>', 'target migration ID to revert to')
  .option('-n, --count <number>', 'number of migrations to revert', '1')
  .option('-c, --connection <url>', 'database connection URL')
  .option('--table <name>', 'migrations table name', '_migrations')
  .option('--dialect <dialect>', 'database dialect (postgres, sqlite, mysql)', 'postgres')
  .action(async (options) => {
    try {
      const db = await createDbClient(options.connection, options.dialect);
      const runner = new MigrationRunner(db, options.dir, options.table);

      const count = options.target ? undefined : parseInt(options.count, 10);
      const reverted = await runner.down(options.target, count);

      if (reverted.length === 0) {
        console.log('No migrations to revert');
      } else {
        console.log(`Reverted ${reverted.length} migration(s):`);
        for (const id of reverted) {
          console.log(`  ↓ ${id}`);
        }
      }

      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show migration status')
  .option('-d, --dir <path>', 'migrations directory', './migrations')
  .option('-c, --connection <url>', 'database connection URL')
  .option('--table <name>', 'migrations table name', '_migrations')
  .option('--dialect <dialect>', 'database dialect (postgres, sqlite, mysql)', 'postgres')
  .action(async (options) => {
    try {
      const db = await createDbClient(options.connection, options.dialect);
      const runner = new MigrationRunner(db, options.dir, options.table);

      const status = await runner.status();

      if (status.length === 0) {
        console.log('No migrations found');
      } else {
        console.log('Migration status:');
        for (const s of status) {
          const symbol = s.executed ? '✓' : '○';
          const date = s.executedAt ? ` (${s.executedAt.toISOString()})` : '';
          console.log(`  ${symbol} ${s.id}_${s.name}${date}`);
        }
        const executed = status.filter((s) => s.executed).length;
        console.log(`\n${executed}/${status.length} migrations executed`);
      }

      process.exit(0);
    } catch (error) {
      console.error('Status check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

async function createDbClient(connectionUrl: string | undefined, dialect: string): Promise<DatabaseClient> {
  const url = connectionUrl || process.env.DATABASE_URL;

  if (!url) {
    throw new DatabaseUrlRequiredProblem();
  }

  switch (dialect) {
    case 'postgres': {
      const pool = new Pool({ connectionString: url });
      const drizzleDb = drizzle(pool);
      return drizzleDb as unknown as DatabaseClient;
    }
    default:
      throw new UnsupportedDialectProblem(dialect);
  }
}

program.parse();
