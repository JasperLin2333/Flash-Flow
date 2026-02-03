
import { describe, it, expect } from 'vitest';
import { extractBalancedJson, validateWorkflow } from './utils';

describe('Agent Utils', () => {
    describe('extractBalancedJson', () => {
        it('should extract simple JSON with "nodes"', () => {
            const input = 'Here is the plan: {"nodes": [], "edges": []}';
            expect(extractBalancedJson(input)).toBe('{"nodes": [], "edges": []}');
        });

        it('should extract JSON with "Nodes" (case insensitive)', () => {
            const input = 'Here is the plan: {"Nodes": [], "edges": []}';
            // The function returns the raw string, so it should preserve case
            expect(extractBalancedJson(input)).toBe('{"Nodes": [], "edges": []}');
        });

        it('should extract JSON wrapped in markdown code blocks', () => {
            const input = '```json\n{"nodes": ["a"], "edges": []}\n```';
            expect(extractBalancedJson(input)).toBe('{"nodes": ["a"], "edges": []}');
        });

        it('should return null for invalid JSON structure', () => {
            const input = 'No json here';
            expect(extractBalancedJson(input)).toBeNull();
        });

        it('should return null if "nodes" key is missing', () => {
            const input = '{"other": "stuff"}';
            expect(extractBalancedJson(input)).toBeNull();
        });
        
        it('should handle nested braces correctly', () => {
            const input = '{"nodes": [{"data": {"info": "{}"}}], "edges": []}';
            expect(extractBalancedJson(input)).toBe('{"nodes": [{"data": {"info": "{}"}}], "edges": []}');
        });

        it('should skip invalid JSON blocks and find the valid one', () => {
            const input = `
                Some thoughts with partial json: {"nodes": []} 
                Final JSON: {"nodes": ["real"], "edges": []}
            `;
            expect(extractBalancedJson(input)).toBe('{"nodes": ["real"], "edges": []}');
        });

        it('should return the last valid JSON block if multiple exist', () => {
            const input = `
                First: {"nodes": ["1"], "edges": []}
                Second: {"nodes": ["2"], "edges": []}
            `;
            expect(extractBalancedJson(input)).toBe('{"nodes": ["2"], "edges": []}');
        });

        it('should prefer the more complete workflow JSON when multiple exist', () => {
            const input = `
                Old (longer): {"nodes": ["1", "1", "1", "1"], "edges": [{"source":"a","target":"b"}]}
                New (shorter): {"nodes": ["2"], "edges": []}
            `;
            expect(extractBalancedJson(input)).toBe('{"nodes": ["1", "1", "1", "1"], "edges": [{"source":"a","target":"b"}]}');
        });
    });

    describe('validateWorkflow - Deterministic Fix Only', () => {
        it('should not block on cycles (report-only / pass-through)', () => {
            const nodes = [
                { id: '1', type: 'input', data: { label: 'Input' } },
                { id: '2', type: 'llm', data: { label: 'LLM', model: 'm', systemPrompt: 'hi' } },
                { id: '3', type: 'output', data: { label: 'Output', inputMappings: { mode: 'direct', sources: [{ type: 'static', value: 'ok' }] } } },
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '1' }, // Cycle
                { source: '2', target: '3' }
            ];

            const result = validateWorkflow(nodes, edges);
            expect(result.softPass).toBe(true);
        });

        it('should remove edges referring to non-existent nodes', () => {
            const nodes = [
                { id: '1', type: 'input', data: { label: 'Input' } },
                { id: '2', type: 'output', data: { label: 'Output', inputMappings: { mode: 'direct', sources: [{ type: 'static', value: 'ok' }] } } },
            ];
            const edges = [{ source: '1', target: '999' }];

            const result = validateWorkflow(nodes, edges);

            expect(result.fixedEdges?.some(e => e.target === '999')).toBe(false);
        });
    });

    describe('validateWorkflow - Deterministic Variable Fix', () => {
        it('should normalize ID/field references deterministically', () => {
            const nodes = [
                { id: 'node_1', type: 'input', data: { label: 'UserQuery' } },
                { 
                    id: 'node_2', 
                    type: 'llm', 
                    data: { 
                        label: 'LLM',
                        model: 'm',
                        systemPrompt: 'Hello {{node_1.text}}' // Wrong: using ID
                    } 
                },
                { id: 'node_3', type: 'output', data: { label: 'Output', inputMappings: { mode: 'direct', sources: [{ type: 'static', value: 'ok' }] } } },
            ];
            const edges = [
                { source: 'node_1', target: 'node_2' },
                { source: 'node_2', target: 'node_3' }
            ];

            const result = validateWorkflow(nodes, edges);

            const fixedLLM = result.fixedNodes?.find(n => n.id === 'node_2');
            expect(fixedLLM.data.systemPrompt).toBe('Hello {{UserQuery.user_input}}');
        });

        it('should not fix ambiguous prefixes (keeps original text)', () => {
            const nodes = [
                { id: '1', type: 'input', data: { label: 'My Input' } },
                { 
                    id: '2', 
                    type: 'llm', 
                    data: { 
                        label: 'LLM',
                        model: 'm',
                        systemPrompt: 'Analyze {{Input.text}}'
                    } 
                },
                { id: '3', type: 'output', data: { label: 'Output', inputMappings: { mode: 'direct', sources: [{ type: 'static', value: 'ok' }] } } },
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '3' }
            ];

            const result = validateWorkflow(nodes, edges);

            const fixedLLM = result.fixedNodes?.find(n => n.id === '2');
            expect(fixedLLM.data.systemPrompt).toBe('Analyze {{Input.text}}');
        });
    });
});
