**_Coding Guidelines_**

1. Always use namespace imports for code readability, except when you need default exports.
   GOOD: `import * as coolLib from 'cool-lib'`
   BAD: `import { coolFunction } from 'cool-lib'`
2. Avoid using the `any` type or casting to `as any` whenever possible.
3. Create utility types whenever possible and relevant, using the `type` keyword, never the `interface` keyword.
4. When defining functions, use the modern closure style.
   GOOD: `const myFunction = (args): Return => {}`
   BAD: `function myFunction(args) {}`
5. If a value could be null or undefined, always check for that instead of coercing to a boolean.
   GOOD: `if (maybeValue != null) {}`
   BAD: `if (maybeValue)`
6. Never put emojis in comments.
7. If a function requires more than 2 arguments, use a named arguments object for readability.
   GOOD: `const bigFunction = (args: {arg1: T1, arg2: T2, arg3: T3}) => { const { arg1, arg2, arg3 } = args }`
   BAD: `const bigFunction = (arg1: T1, arg2: T2, arg3: T3) => { ... }`
8. When creating new functions, add explanatory comments using JSDoc.
9. Avoid deeply nested functionality. If there's a big function, or some functionality that gets reused in multiple places, take that into its own utility function.
