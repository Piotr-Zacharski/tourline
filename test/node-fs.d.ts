// The one Node API the theme test uses. Tests run in Node, but the project ships no @types/node.
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
