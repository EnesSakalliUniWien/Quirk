/** Vite serves `?raw` imports as the file's text; the advisory type-check needs telling. */
declare module "*.svg?raw" {
  const markup: string;
  export default markup;
}
