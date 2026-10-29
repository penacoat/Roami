module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["<rootDir>/test/**/*.test.ts"],
    testPathIgnorePatterns: ["/node_modules/", "/lib/"],
    transform: {"^.+\\.ts$": ["ts-jest", {tsconfig: "tsconfig.test.json"}]},
  };