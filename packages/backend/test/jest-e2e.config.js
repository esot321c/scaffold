export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: false,
            decorators: true,
          },
          target: 'es2021',
          keepClassNames: true,
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
        },
        module: {
          type: 'es6',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^src/(.*)$': '<rootDir>/../src/$1', // Add this line to handle src/ imports
    '^@scaffold/types(.*)$': '<rootDir>/../../types/dist$1',
    '^@scaffold/timezone-utils(.*)$': '<rootDir>/../../timezone-utils/dist$1',
  },
};
