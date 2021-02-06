declare module "lz4js" {
    import lz4 from "lz4js";
    export function compress(arr: Uint8Array): Uint8Array;
    export function decompress(arr: Uint8Array): Uint8Array;
}