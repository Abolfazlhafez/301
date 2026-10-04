declare module "stylis" {
  export const prefixer: (...args: unknown[]) => string | void;
  export function serialize(...args: unknown[]): string;
  export function compile(...args: unknown[]): unknown;
  export function middleware(...args: unknown[]): unknown;
  export function stringify(...args: unknown[]): string;
}
