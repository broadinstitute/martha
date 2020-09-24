/*
    More information about rules can be found on ESLint website https://eslint.org/docs/rules/
 */

module.exports = {
    "env": {
        "commonjs": true,
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 11
    },
    "rules": {
        "accessor-pairs": "error",                   // enforces a style which requires a getter for every property which has a setter defined
        "array-bracket-newline": "off",              // enforces line breaks after opening and before closing array brackets
        "array-bracket-spacing": [                   // enforces consistent spacing inside array brackets
            "error",
            "never"                                  // never: disallow spaces
        ],
        "array-callback-return": "error",            // enforces usage of return statement in callbacks of array's methods
        "array-element-newline": "off",              // enforces line breaks between array elements
        "arrow-body-style": "off",                   // enforce or disallow the use of braces around arrow function body
        "arrow-parens": [                            // enforces parentheses around arrow function parameters
            "error",
            "always"
        ],
        "arrow-spacing": [                           // require space before/after arrow function's arrow
            "error",
            {
                "after": true,
                "before": true
            }
        ],
        "block-scoped-var": "error",                 // treat var as Block Scoped
        "block-spacing": [                           // enforce spaces inside of blocks after opening block and before closing block
            "error",
            "always"
        ],
        "brace-style": "off",                        // enforces consistent brace style for blocks
        "capitalized-comments": "off",               // enforce or disallow capitalization of the first letter of a comment
        "class-methods-use-this": "error",           // enforce that class methods utilize this
        "comma-dangle": [                            // enforces consistent use of trailing commas in object and array literals
            "error",
            "only-multiline"                         // allows (but does not require) trailing commas when the last element or property is in a different line than the closing ] or }
        ],
        "comma-spacing": [                           // enforces consistent spacing before and after commas in variable declarations, array literals, object literals, function parameters, and sequences
            "error",
            {
                "after": true,
                "before": false
            }
        ],
        "comma-style": [                             // enforce consistent comma style in array literals, object literals, and variable declarations
            "error",
            "last"                                   // last: requires a comma after and on the same line as an array element, object property, or variable declaration
        ],
        "complexity": "error",                       // limit cyclomatic complexity. Default: 20
        "computed-property-spacing": [               // disallow spacing inside computed property brackets
            "error",
            "never"
        ],
        "consistent-return": "off",                  // require return statements to either always or never specify values
        "consistent-this": "error",                  // enforces consistency regarding variables that are designated alias names for 'this' (like that, self or me). Rules are mentioned in https://eslint.org/docs/rules/consistent-this#rule-details
        "curly": "error",                            // require block statements to be wrapped in curly braces
        "default-case": "error",                     // require default case in switch statements
        "default-case-last": "off",                  // enforce default clauses in switch statements to be last
        "default-param-last": "error",               // enforce default parameters to be last
        "dot-location": [                            // enforce newline before and after dot
            "error",
            "property"                               // property: dot in a member expression should be on the same line as the property portion
        ],
        "dot-notation": "error",                     // require dot notation over square bracket notation
        "eol-last": [                                // enforces at least one newline at the end of non-empty files
            "error",
            "always"
        ],
        "eqeqeq": "error",                           // eliminates type-unsafe equality operators. Default: always
        "func-call-spacing": "error",                // disallow spacing between function identifiers and their invocations
        "func-name-matching": "error",               // require function names to match the name of the variable or property to which they are assigned
        "func-names": "off",                         // require or disallow named function expressions
        "func-style": [                              // requires the use of function declarations instead of function expressions
            "error",
            "declaration",
            {
                "allowArrowFunctions": true
            }
        ],
        "function-call-argument-newline": [          // requires consistent usage of line breaks between arguments
            "error",
            "consistent"
        ],
        "function-paren-newline": "off",             // enforce consistent line breaks inside function parentheses
        "generator-star-spacing": "error",           // enforce spacing around the '*' in generator functions
        "grouped-accessor-pairs": "error",           // requires grouped definitions of accessor functions for the same property in object literals, class declarations and class expressions
        "guard-for-in": "error",                     // prevents unexpected behavior that could arise from using a 'for in' loop without filtering the results
        "id-blacklist": [                            // disallows specified identifiers in assignments and function definitions
            "error",
            "callback"
        ],
        "id-length": [                               // enforces a minimum and/or maximum identifier length convention
            "error",
            {
                "min": 1,
                "max": 30
            }
        ],
        "id-match": "error",
        "implicit-arrow-linebreak": [                // enforce a consistent location for an arrow function containing an implicit return
            "error",
            "beside"                                 // beside: disallows a newline before an arrow function body
        ],
        "indent": [
            "error",                                 // enforces a consistent indentation style. Default is 4 spaces
            4,                                       // enforces a consistent indentation style. Default is 4 spaces
            {
                "SwitchCase": 1                      // enforces indentation level for case clauses in switch statements
            }
        ],
        "init-declarations": "off",                  // enforcing or eliminating variable initializations during declaration
        "jsx-quotes": "error",                       // enforces the consistent use of either double or single quotes in JSX attributes. Default: double quotes
        "key-spacing": "error",                      // enforces consistent spacing between keys and values in object literal properties. Default: space after colon
        "keyword-spacing": "error",                  // enforces consistent spacing around keywords and keyword-like tokens. Default: space before & after keyword is required
        "line-comment-position": "off",              // enforces consistent position of line comments. Block comments are not affected by this rule.
        "linebreak-style": [                         // enforces consistent line endings independent of operating system
            "error",
            "unix"
        ],
        "lines-around-comment": "off",               // enforces empty lines before and/or after comments
        "lines-between-class-members": "error",      // require or disallow an empty line between class members. Default: always
        "max-classes-per-file": "off",               // enforces a maximum number of classes per file
        "max-depth": "error",                        // enforces a maximum depth that blocks can be nested to reduce code complexity. Default: 4
        "max-len": "off",                            // enforces a maximum line length
        "max-lines": "off",                          // enforces a maximum number of lines per file
        "max-lines-per-function": "off",             // enforces a maximum number of lines per function
        "max-nested-callbacks": "error",             // enforces a maximum depth that callbacks can be nested to increase code clarity. Default: 10
        "max-params": "off",                         // enforces a maximum number of parameters allowed in function definitions
        "max-statements": "off",                     // enforces a maximum number of statements allowed in function blocks
        "max-statements-per-line": [                 // enforces a maximum number of statements allowed per line
            "error",
            { "max": 2 }
        ],
        "multiline-comment-style": "off",            // enforces a particular style for multiline comments
        "multiline-ternary": "off",                  // enforces or disallows newlines between operands of a ternary expression
        "new-cap": "error",                          // requires constructor names to begin with a capital letter
        "new-parens": "error",                       // requires parentheses when invoking a constructor with no arguments
        "newline-after-var": "off",                  // require or disallow an empty line after variable declarations
        "newline-before-return": "off",              // require an empty line before return statements
        "newline-per-chained-call": "off",           // require a newline after each call in a method chain
        "no-alert": "error",                         // disallow use of UI debugging code that should be removed and replaced with less obstrusive custom UIs
        "no-array-constructor": "error",             // disallow Array constructors
        "no-await-in-loop": "error",                 // disallow await inside loops
        "no-bitwise": "error",                       // disallow bitwise operators
        "no-caller": "error",                        // disallow use of deprecated code of caller/callee
        "no-confusing-arrow": "error",               // disallow arrow functions where they could be confused with comparisons
        "no-console": "off",                         // disallow calls to methods of the console object
        "no-constructor-return": "error",            // disallow return statements in the constructor of a class
        "no-continue": "error",                      // disallow continue statements
        "no-div-regex": "error",                     // disallow regular expressions that look like division
        "no-duplicate-imports": "error",             // requires that all imports from a single module exists in a single import statement
        "no-else-return": "off",                     // disallow unnecessary blocks of code following an if that contain a return statement
        "no-empty-function": "error",                // disallow empty functions
        "no-eq-null": "error",                       // disallow null comparisons using '==' or '!='
        "no-eval": "error",                          // disallow use of eval() function
        "no-extend-native": "error",                 // disallow directly modifying the prototype of builtin objects
        "no-extra-bind": "error",                    // disallow unnecessary function binding using 'bind()' function
        "no-extra-label": "error",                   // disallow unnecessary labels
        "no-extra-parens": "off",                    // disallow unnecessary extra parentheses
        "no-floating-decimal": "error",              // disallow floating decimals (for eg: .5) to make it clear if it's a decimal or dot operator
        "no-global-assign": "error",                 // disallow assignment to native objects or read-only global variables
        "no-implicit-coercion": "error",             // disallow implicit coercion with aim to flag shorter notations for type conversion
        "no-implicit-globals": "error",              // disallow var and function declarations at the top-level script scope
        "no-implied-eval": "error",                  // aims to eliminate implied eval() through the use of setTimeout(), setInterval() or execScript()
        "no-inline-comments": "off",                 // disallows comments on the same line as code
        "no-invalid-this": "error",                  // aims to flag usage of this keyword outside of classes or class-like objects
        "no-iterator": "error",                      // aims at preventing errors that may arise from using the '__iterator__' property
        "no-label-var": "error",                     // disallow labels that are variable names
        "no-labels": "error",                        // disallow use of labeled statements
        "no-lone-blocks": "error",                   // aims to eliminate unnecessary and potentially confusing blocks at the top level of a script or within other blocks
        "no-lonely-if": "error",                     // disallow if statements as the only statement in else blocks
        "no-loop-func": "error",                     // disallow any function within a loop that contains unsafe references
        "no-loss-of-precision": "error",             // disallow number literals that lose precision at runtime when converted to a JS Number
        "no-magic-numbers": "off",                   // disallow magic numbers
        "no-mixed-operators": "error",               // disallow mixing different operators without extra parentheses
        "no-mixed-requires": "error",                // disallow require calls that are mixed with regular variable declarations
        "no-multi-assign": "error",                  // disallow using multiple assignments within a single statement
        "no-multi-spaces": [                         // disallow multiple whitespaces
            "error",
            { "ignoreEOLComments": true }            // ignores multiple spaces before comments that occur at the end of lines
        ],
        "no-multi-str": "error",                     // disallow use of multiline strings
        "no-multiple-empty-lines": [                 // disallow multiple empty lines
            "error",
            {
                "max": 2,
                "maxEOF": 1,
                "maxBOF": 0
            }
        ],
        "no-negated-condition": "off",               // disallow negated conditions
        "no-negated-in-lhs": "error",                // disallow negating the left operand in in expressions
        "no-nested-ternary": "error",                // disallow nested ternary expressions
        "no-new": "error",                           // disallow constructor calls using the new keyword that do not assign the resulting object to a variable
        "no-new-func": "error",                      // disallow use of Function constructor
        "no-new-object": "error",                    // disallow Object constructors
        "no-new-wrappers": "error",                  // disallow use of String, Number, and Boolean with the new operator
        "no-octal-escape": "error",                  // disallow octal escape sequences in string literals
        "no-param-reassign": "error",                // disallow reassignment of function parameters
        "no-plusplus": "error",                      // disallow the unary operators '++' and '--'
        "no-proto": "error",                         // disallow use of '__proto__'
        "no-restricted-exports": "off",              // disallow specified names from being used as exported names
        "no-restricted-globals": "off",              // allows you to specify global variable names that you don't want to use in your application
        "no-restricted-imports": "off",              // allows you to specify imports that you don't want to use in your application
        "no-restricted-properties": "off",           // disallow certain object properties
        "no-restricted-syntax": "off",               // disallow user-specified syntax
        "no-return-assign": "error",                 // disallow assignments in return statements. Default: except-parens- disallow assignments unless they are enclosed in parentheses
        "no-return-await": "error",                  // disallow return await inside async function
        "no-script-url": "error",                    // disallow script urls i.e. usage of 'javascript:URL'
        "no-self-compare": "error",                  // disallow comparing something to itself
        "no-sequences": "error",                     // disallow use of comma operator
        "no-shadow": "off",                          // disallow variable declarations from shadowing variables declared in the outer scope
        "no-tabs": "error",                          // disallow usage of tabs (even in comments)
        "no-template-curly-in-string": "error",      // disallow template literal placeholder syntax in regular strings
        "no-ternary": "off",                         // disallow ternary operators
        "no-throw-literal": "error",                 // disallow throwing literals and other expressions as exceptions. Only Error objects can be throws as exceptions
        "no-trailing-spaces": "error",               // disallow trailing whitespace (spaces, tabs, and other Unicode whitespace characters) at the end of lines
        "no-undef-init": "error",                    // disallow variable declarations that initialize to undefined
        "no-undefined": "error",                     // disallow use of undefined
        "no-underscore-dangle": "off",               // disallow dangling underscores in identifiers
        "no-unmodified-loop-condition": "error",     // variables in a loop condition often are modified in the loop. If not, it's possibly a mistake
        "no-unneeded-ternary": "error",              // disallow ternary operators when simpler alternatives exist
        "no-unused-expressions": "error",            // disallow unused expressions which have no effect on the state of the program
        "no-use-before-define": "error",             // disallow reference to an identifier that has not yet been declared
        "no-useless-backreference": "error",         // detect and disallow the following backreferences in regular expression. Specific backreferences it disallows can be found at https://eslint.org/docs/rules/no-useless-backreference#rule-details
        "no-useless-call": "error",                  // disallow the usages of Function.prototype.call() and Function.prototype.apply() that can be replaced with the normal function invocation
        "no-useless-computed-key": "error",          // disallow unnecessary usage of computed property keys
        "no-useless-concat": "error",                // disallow concatenation of 2 literals when they could be combined into a single literal
        "no-useless-constructor": "error",           // flags class constructors that can be safely removed without changing how the class works
        "no-useless-rename": "error",                // disallow the renaming of import, export, and destructured assignments to the same name
        "no-useless-return": "error",                // disallow redundant return statements
        "no-var": "error",                           // aimed at discouraging the use of var and encouraging the use of const or let instead
        "no-void": "error",                          // disallow use of void operator
        "no-warning-comments": "off",                // reports comments that include any of the predefined terms like 'TODO' or 'FIXME'
        "no-whitespace-before-property": "error",    // disallow whitespace around the dot or before the opening bracket before properties of objects if they are on the same line
        "nonblock-statement-body-position": "error", // enforce a consistent location for single-line statements. Default: 'besides'- disallows a newline before a single-line statement
        "object-curly-newline": [                    // enforces consistent line breaks inside braces
            "error",
            { "consistent": true }                   // consistent: requires that both open and closing curly braces are consistent on whether they directly enclose newlines
        ],
        "object-curly-spacing": "off",               // enforces consistent spacing inside braces of object literals, destructuring assignments, and import/export specifiers
        "object-shorthand": "off",                   // enforces the use of the shorthand syntax
        "one-var": "off",                            // enforces variables to be declared either together or separately per function ( for var) or block (for let and const) scope
        "one-var-declaration-per-line": "error",     // enforces consistent newlines around variable declarations
        "operator-assignment": "error",              // requires assignment operator shorthand where possible
        "operator-linebreak": "off",                 // enforces a consistent line break style for operators
        "padded-blocks": "off",                      // enforces consistent empty line padding within blocks
        "padding-line-between-statements": "off",    // requires or disallows blank lines between the two kinds of statements
        "prefer-arrow-callback": [                   // require using arrow functions for callbacks or function arguments where possible
            "error",
            { "allowNamedFunctions": true }          // allows named functions as callbacks or function arguments
        ],
        "prefer-const": "error",                     // aimed at flagging variables that are declared using let keyword, but never reassigned after the initial assignment
        "prefer-destructuring": "off",               // require destructuring from arrays and objects
        "prefer-exponentiation-operator": "error",   // disallow calls to Math.pow() and suggests using the '**' operator instead
        "prefer-named-capture-group": "off",         // aimed at using named capture groups instead of numbered capture groups in regular expressions
        "prefer-numeric-literals": "error",          // disallow parseInt() and Number.parseInt() in favor of binary, octal, and hexadecimal literals
        "prefer-object-spread": "error",             // prefer use of an object spread over Object.assign
        "prefer-promise-reject-errors": "error",     // require using Error objects as Promise rejection reasons
        "prefer-regex-literals": "error",            // disallow the use of the RegExp constructor function with string literals as its arguments
        "prefer-rest-params": "error",               // disallow usage of arguments[] variables passed to functions and use variadic functions instead
        "prefer-spread": "error",                    // disallow usage of Function.prototype.apply() in situations where spread syntax could be used instead
        "prefer-template": "error",                  // disallow usage of + operators with strings
        "quote-props": [                             // require quotes around object literal property names
            "error",
            "consistent"                             // enforces a consistent quote style; in a given object, either all of the properties should be quoted, or none of the properties should be quoted
        ],
        "quotes": "off",                             // enforces the consistent use of either backticks, double, or single quotes
        "radix": [                                   // requires passing the radix parameter when using parseInt()
            "error",
            "as-needed"                              // disallows providing the 10 radix
        ],
        "require-atomic-updates": "error",           // disallow assignments that can lead to race conditions due to usage of await or yield
        "require-await": "error",                    // warns async functions which have no await expression
        "require-unicode-regexp": "off",             // enforce the use of 'u' flag on regular expressions
        "rest-spread-spacing": "error",              // enforce consistent spacing between rest and spread operators and their expressions
        "semi": "error",                             // requires semicolons at the end of statements
        "semi-spacing": "error",                     // enforce spacing around a semicolon. Default: {"before": false, "after": true}
        "semi-style": [                              // enforces that semicolons are at the end of statements
            "error",
            "last"
        ],
        "sort-imports": "error",                     // requires all import declarations and verifies that all imports are first sorted by the used member syntax and then alphabetically by the first member
        "sort-keys": "off",                          // checks all property definitions of object expressions and verifies that all variables are sorted alphabetically
        "sort-vars": "error",                        // checks all variable declaration blocks and verifies that all variables are sorted alphabetically
        "space-before-blocks": "off",                // enforce consistency of spacing before blocks. It is only applied on blocks that don’t begin on a new line
        "space-before-function-paren": "off",        // require or disallow a space before function parenthesis
        "space-in-parens": [                         // enforce consistent spacing directly inside of parentheses
            "error",
            "never"                                  // never: enforces zero spaces inside of parentheses
        ],
        "space-infix-ops": "off",                    // require spacing around infix operators
        "space-unary-ops": [                         // enforces consistency regarding the spaces around unary operators
            "error",
            { "words": true }                        // words: applies to unary word operators such as: new, delete, typeof, void, yield
        ],
        "spaced-comment": [                          // enforce consistency of spacing after the start of a comment '//' or '/*'
            "error",
            "always"
        ],
        "strict": [                                  // requires or disallows strict mode directives
            "error",
            "never"                                  // never: disallows strict mode directives
        ],
        "switch-colon-spacing": "error",             // controls spacing around colons of case and default clauses in switch statements. Default: { "after": true, "before": false}
        "symbol-description": "error",               // requires a description when creating symbols
        "template-curly-spacing": [                  // aims to maintain consistent spacing inside of template literals
            "error",
            "never"                                  // never: disallows spaces inside of the curly brace pair
        ],
        "template-tag-spacing": "error",             // aims to maintain consistent spacing between template tag functions and their template literals. Default: never
        "unicode-bom": [                             // require or disallow the Unicode Byte Order Mark
            "error",
            "never"                                  // never: files must not begin with the Unicode BOM
        ],
        "vars-on-top": "error",                      // require variable declarations to be at the top of their scope
        "wrap-iife": "error",                        // requires all immediately-invoked function expressions to be wrapped in parentheses
        "wrap-regex": "error",                       // requires regex expressions to be wrapped using parentheses to make them more readable
        "yield-star-spacing": "error",               // enforces spacing around the '*' in 'yield*' expressions. Default: {"before": false, "after": true}
        "yoda": [                                    // enforce consistent style of conditions which compare a variable to a literal value
            "error",
            "never"
        ]
    }
};
