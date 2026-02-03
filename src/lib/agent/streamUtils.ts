
export interface StreamTagEvent {
    type: 'tag_open' | 'tag_close' | 'content';
    tagName?: string;
    attributes?: Record<string, string>;
    content?: string;
}

export class StreamXmlParser {
    private buffer = "";
    private currentTag: { name: string, attributes: Record<string, string> } | null = null;
    private onEvent: (event: StreamTagEvent) => void;

    constructor(onEvent: (event: StreamTagEvent) => void) {
        this.onEvent = onEvent;
    }

    process(chunk: string) {
        this.buffer += chunk;
        this.parse();
    }

    private parse() {
        while (true) {
            if (!this.currentTag) {
                // Looking for opening tag
                const tagStart = this.buffer.indexOf('<step');
                if (tagStart === -1) {
                    // No tag start found, keep last few chars in case of split tag
                    if (this.buffer.length > 20) {
                        // We are not inside a tag, so we ignore content outside? 
                        // Actually, for this agent, content outside <step> is usually noise or preamble, 
                        // but JSON might be at the end.
                        // Let's just keep the buffer reasonable size if we are sure no tag is starting.
                        // But wait, <plan> is also a tag we might care about?
                        // The prompt uses <step> and <plan> (in analysis prompt).
                        // Let's support generic tags.
                    }
                    return; 
                }

                // Check if we have the full opening tag
                const tagEnd = this.buffer.indexOf('>', tagStart);
                if (tagEnd === -1) {
                    // Tag is incomplete
                    return;
                }

                // We have a full opening tag
                const tagContent = this.buffer.slice(tagStart + 1, tagEnd);
                const tagNameMatch = tagContent.match(/^(\w+)/);
                if (!tagNameMatch) {
                    // Invalid tag? skip it
                    this.buffer = this.buffer.slice(tagEnd + 1);
                    continue;
                }
                const tagName = tagNameMatch[1];
                
                // Parse attributes
                const attributes: Record<string, string> = {};
                const attrRegex = /(\w+)="([^"]*)"/g;
                let match;
                while ((match = attrRegex.exec(tagContent)) !== null) {
                    attributes[match[1]] = match[2];
                }

                this.currentTag = { name: tagName, attributes };
                this.onEvent({ type: 'tag_open', tagName, attributes });
                
                // Remove processed part
                this.buffer = this.buffer.slice(tagEnd + 1);
            } else {
                // We are inside a tag, looking for closing tag
                const closeTag = `</${this.currentTag.name}>`;
                const closeIndex = this.buffer.indexOf(closeTag);

                if (closeIndex === -1) {
                    // Closing tag not found yet. 
                    // Emit content, but be careful not to emit partial closing tag
                    // e.g. "content </st"
                    const safeEnd = Math.max(0, this.buffer.length - closeTag.length);
                    if (safeEnd > 0) {
                        const content = this.buffer.slice(0, safeEnd);
                        if (content) {
                            this.onEvent({ type: 'content', content });
                        }
                        this.buffer = this.buffer.slice(safeEnd);
                    }
                    return;
                }

                // Found closing tag
                const content = this.buffer.slice(0, closeIndex);
                if (content) {
                    this.onEvent({ type: 'content', content });
                }
                
                this.onEvent({ type: 'tag_close', tagName: this.currentTag.name });
                this.currentTag = null;
                
                // Remove processed part
                this.buffer = this.buffer.slice(closeIndex + closeTag.length);
            }
        }
    }

    // Flush remaining buffer if needed (usually not needed for XML stream unless incomplete)
    flush() {
        if (this.currentTag && this.buffer) {
            this.onEvent({ type: 'content', content: this.buffer });
            this.buffer = "";
        }
    }
}
