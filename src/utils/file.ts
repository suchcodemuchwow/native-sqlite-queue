import * as fs from 'node:fs';

// Read sql file and return the content as a string
export const readSqlFile = (filePath: string): string => {
  return fs.readFileSync(filePath, 'utf8');
};
