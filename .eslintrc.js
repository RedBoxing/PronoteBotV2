module.exports = {
	"env": {
		"browser": false,
		"es2021": true
	},
	"extends": [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"prettier",
		"plugin:prettier/recommended"
	],
	"overrides": [
	],
	"parser": "@typescript-eslint/parser",
	"parserOptions": {
		"ecmaVersion": "latest",
		"sourceType": "module"
	},
	"plugins": [
		"@typescript-eslint"
	],
	"rules": {
		"no-var": "error",
		"no-undef": "error",
		"prefer-const": "error",
		"no-param-reassign": "error",
		"arrow-parens": ["error", "as-needed"],
		"prefer-destructuring": "warn",
		"prefer-template": "warn",
		"object-shorthand": "warn",
		"object-curly-spacing": ["warn", "always"],
		"@typescript-eslint/no-unused-vars": "warn",
		"@typescript-eslint/no-var-requires": "warn",
		"@typescript-eslint/ban-ts-ignore": "off",
		"@typescript-eslint/ban-ts-comment": "off",
		"@typescript-eslint/no-explicit-any": "off",
		"@typescript-eslint/explicit-function-return-type": "off",
		"@typescript-eslint/explicit-module-boundary-types": "off",
		"@typescript-eslint/no-empty-interface": [
			"error",
			{
				"allowSingleExtends": true
			}
		],
		"no-console": "off",
		"indent": ["error", 4, { "MemberExpression": "off" }]
	}
};
