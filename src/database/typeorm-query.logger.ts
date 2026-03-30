import { Logger as NestLogger } from '@nestjs/common';
import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';

export class TypeOrmQueryLogger implements TypeOrmLogger {
  private readonly logger = new NestLogger(TypeOrmQueryLogger.name);

  constructor(private readonly verboseQueryLogging: boolean) {}

  logQuery(query: string, parameters?: unknown[], _queryRunner?: QueryRunner) {
    if (!this.verboseQueryLogging) return;

    const table = this.extractTableName(query);
    const params = parameters && parameters.length > 0 ? JSON.stringify(parameters) : '[]';

    this.logger.debug(`query=${query} table=${table ?? 'unknown'} params=${params}`);
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ) {
    const table = this.extractTableName(query);
    const params = parameters && parameters.length > 0 ? JSON.stringify(parameters) : '[]';
    const message = error instanceof Error ? error.message : error;
    this.logger.error(`query-error=${message} query=${query} table=${table ?? 'unknown'} params=${params}`);
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ) {
    const table = this.extractTableName(query);
    const params = parameters && parameters.length > 0 ? JSON.stringify(parameters) : '[]';
    this.logger.warn(`slow-query=${time}ms query=${query} table=${table ?? 'unknown'} params=${params}`);
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner) {
    this.logger.log(message);
  }

  logMigration(message: string, _queryRunner?: QueryRunner) {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown, _queryRunner?: QueryRunner) {
    const rendered = String(message);
    if (level === 'warn') {
      this.logger.warn(rendered);
      return;
    }

    this.logger.log(rendered);
  }

  private extractTableName(query: string): string | null {
    const normalized = query.replace(/\s+/g, ' ').trim();

    const insertMatch = normalized.match(/^INSERT INTO\s+`?([^`\s(]+)`?/i);
    if (insertMatch?.[1]) return insertMatch[1];

    const updateMatch = normalized.match(/^UPDATE\s+`?([^`\s]+)`?/i);
    if (updateMatch?.[1]) return updateMatch[1];

    const deleteMatch = normalized.match(/^DELETE FROM\s+`?([^`\s]+)`?/i);
    if (deleteMatch?.[1]) return deleteMatch[1];

    const fromMatch = normalized.match(/\sFROM\s+`?([^`\s]+)`?/i);
    if (fromMatch?.[1]) return fromMatch[1];

    return null;
  }
}
