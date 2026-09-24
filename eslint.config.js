const globals = require("globals");

module.exports = [
    {
        files: ["public/js/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "script",
            globals: {
                ...globals.browser,
                ...globals.es2021
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "error",
            "no-unreachable": "error",
            "no-dupe-keys": "error",
            "no-duplicate-case": "error",
            "no-redeclare": "warn",
            "no-constant-condition": "warn",
            "no-unreachable-loop": "warn",
            "eqeqeq": "warn",
            "curly": ["warn", "multi-line"],
            "no-console": "off"
        }
    }
];
