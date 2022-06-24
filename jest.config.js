module.exports = {
    "roots": [
        "<rootDir>/src"
    ],
    "verbose":true,
    "testURL":"http://react-hook-useobserver",
    "testEnvironment" : "node",
    "testMatch": [
        "**/__tests__/**/*.+(ts|tsx|js)",
        "**/?(*.)+(spec|test).+(ts|tsx|js)"
    ],
    "snapshotSerializers": ["enzyme-to-json/serializer"],
    "setupFilesAfterEnv":["<rootDir>/src/setupEnzyme.ts"],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "moduleFileExtensions":[
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "node"
    ]
}