import { TypeOrmQueryLogger } from './typeorm-query.logger';

describe('TypeOrmQueryLogger', () => {
  it('extracts table names from INSERT queries', () => {
    const logger = new TypeOrmQueryLogger(true);
    const extract = (logger as any).extractTableName.bind(logger);

    expect(extract('INSERT INTO `employer_profiles` (`companyName`) VALUES (?)')).toBe('employer_profiles');
    expect(extract('INSERT INTO `` (`companyName`) VALUES (?)')).toBeNull();
  });
});
