/**
 * CSS module type declarations
 */

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
