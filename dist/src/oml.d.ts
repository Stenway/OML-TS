import { ReliableTxtEncoding } from "@stenway/reliabletxt";
export declare class OmlDocument {
    content: any;
    encoding: ReliableTxtEncoding;
    constructor(content: any, encoding?: ReliableTxtEncoding);
    toString(formatting?: OmlFormatting | null, replacer?: OmlReplacer | null): string;
    getBytes(formatting?: OmlFormatting | null, replacer?: OmlReplacer | null): Uint8Array;
    toBase64String(formatting?: OmlFormatting | null, replacer?: OmlReplacer | null): string;
    static parse(str: string, reviver?: OmlReviver | null, encoding?: ReliableTxtEncoding): OmlDocument;
    static fromBytes(bytes: Uint8Array, reviver?: OmlReviver | null): OmlDocument;
    static fromBase64String(base64Str: string, reviver?: OmlReviver | null): OmlDocument;
}
export declare class OmlParserError extends Error {
    readonly index: number;
    readonly lineIndex: number;
    readonly linePosition: number;
    constructor(index: number, lineIndex: number, linePosition: number, message: string);
}
export interface OmlFormatting {
    indentation?: string;
    beforeEqual?: string;
    afterEqual?: string;
    alignChar?: string | null;
    maxLevel?: number;
    reduceSimpleArray?: boolean;
}
export type OmlReviver = (owner: object | null, key: string | number | null, value: any, source: string | null, index: number) => any;
export type OmlReplacer = (root: any, owner: object | null, key: string | number | null, value: any, cyclic: boolean) => any;
export declare abstract class Oml {
    static parse(text: string, reviver?: OmlReviver | null): any;
    static stringify(value: any, formatting?: OmlFormatting | null, replacer?: OmlReplacer | null): string;
}
//# sourceMappingURL=oml.d.ts.map