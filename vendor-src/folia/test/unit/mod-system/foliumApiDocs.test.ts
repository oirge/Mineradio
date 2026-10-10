import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { CONTRACT_PATH, OUTPUT_PATH, parseContract as parseContractJs, renderApiDocs } from '../../../dev/folium/api-docs.mjs';

// test/unit/mod-system/foliumApiDocs.test.ts
// docs/folium/api.md is generated from src/mods/folium/contract.ts. These pin
// that the reference is current (a contract change must come with
// `npm run folium:api`), that every exported type is in it, and that every
// public declaration and member carries a description.

interface ParsedItem { name: string; doc: string; members?: { name: string; doc: string }[] }
const parseContract = (text: string) => parseContractJs(text) as unknown as { title: string; items: ParsedItem[] }[];

const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

describe('Folium API reference', () => {
    it('is up to date with the contract (run `npm run folium:api`)', () => {
        expect(fs.readFileSync(OUTPUT_PATH, 'utf8')).toBe(renderApiDocs(contract));
    });

    it('covers every exported declaration', () => {
        const exported = [...contract.matchAll(/^export (?:interface|type|const) (\w+)/gm)].map((match) => match[1]).sort();
        const documented = parseContract(contract).flatMap((section) => section.items.map((item) => item.name)).sort();
        expect(documented).toEqual(exported);
    });

    it('describes every declaration and member', () => {
        const missing: string[] = [];
        for (const section of parseContract(contract)) {
            for (const item of section.items) {
                if (!item.doc) missing.push(item.name);
                for (const member of item.members ?? []) {
                    if (!member.doc) missing.push(`${item.name}.${member.name}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });
});
