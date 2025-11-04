declare module 'anki-apkg-export' {
  export default class AnkiExport {
    constructor(deckName: string);
    addCard(front: string, back: string, options?: any): void;
    addMedia(filename: string, data: Buffer): void;
    save(): Promise<any>;
  }
}
