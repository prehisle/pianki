declare module 'turndown' {
  interface TurndownOptions {
    headingStyle?: 'setext' | 'atx'
    hr?: string
    bulletListMarker?: '-' | '+' | '*'
    codeBlockStyle?: 'indented' | 'fenced'
    fence?: string
    emDelimiter?: '_' | '*'
    strongDelimiter?: '__' | '**'
    linkStyle?: 'inlined' | 'referenced'
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut'
  }

  export default class TurndownService {
    constructor(options?: TurndownOptions)
    turndown(html: string): string
  }
}
