/// <reference types="nativewind/types" />
// This augments React Native component props with the `className` prop that nativewind
// provides at runtime via its Babel plugin. Without this reference, tsc reports
// "No overload matches this call" / className-not-assignable on every styled RN element.
