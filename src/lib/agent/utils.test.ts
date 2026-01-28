
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
    });

    describe('validateWorkflow - Structure Healing', () => {
        it('should fix circular dependencies', () => {
            const nodes = [
                { id: '1', type: 'input', data: { label: 'Input' } },
                { id: '2', type: 'llm', data: { label: 'LLM' } },
            ];
            const edges = [
                { source: '1', target: '2' },
                { source: '2', target: '1' } // Cycle
            ];

            const result = validateWorkflow(nodes, edges);
            
            expect(result.valid).toBe(true); // Should be valid after healing
            expect(result.fixedEdges?.length).toBe(1); // One edge removed
            expect(result.warnings?.some(w => /修复循环依赖/.test(w))).toBe(true);
        });

        it('should connect isolated islands', () => {
            const nodes = [
                { id: '1', type: 'input', data: { label: 'Input' } },
                { id: '2', type: 'llm', data: { label: 'Processor' } }, // Isolated
                { id: '3', type: 'output', data: { label: 'Output' } }
            ];
            const edges: any[] = []; // No edges

            const result = validateWorkflow(nodes, edges);

            expect(result.valid).toBe(true);
            // Should connect Input -> Processor -> Output
            expect(result.fixedEdges?.length).toBe(2);
            expect(result.warnings?.some(w => /修复孤岛/.test(w))).toBe(true);
        });

        it('should remove edges referring to non-existent nodes', () => {
            const nodes = [{ id: '1', type: 'input', data: { label: 'Input' } }];
            const edges = [{ source: '1', target: '999' }];

            const result = validateWorkflow(nodes, edges);

            expect(result.valid).toBe(true);
            expect(result.fixedEdges?.length).toBe(0);
        });
    });

    describe('validateWorkflow - Variable Healing', () => {
        it('should fix ID references to Label references', () => {
            const nodes = [
                { id: 'node_1', type: 'input', data: { label: 'UserQuery' } },
                { 
                    id: 'node_2', 
                    type: 'llm', 
                    data: { 
                        label: 'LLM',
                        prompt: 'Hello {{node_1.text}}' // Wrong: using ID
                    } 
                }
            ];
            const edges = [{ source: 'node_1', target: 'node_2' }];

            const result = validateWorkflow(nodes, edges);

            expect(result.valid).toBe(true);
            const fixedLLM = result.fixedNodes?.find(n => n.id === 'node_2');
            expect(fixedLLM.data.prompt).toBe('Hello {{UserQuery.text}}');
            expect(result.warnings?.some(w => /Auto-fixed ID reference/.test(w))).toBe(true);
        });

        it('should fix Singleton Type references', () => {
            const nodes = [
                { id: '1', type: 'input', data: { label: 'My Input' } },
                { 
                    id: '2', 
                    type: 'llm', 
                    data: { 
                        label: 'LLM',
                        prompt: 'Analyze {{Input.text}}' // Wrong: using Type "Input"
                    } 
                }
            ];
            const edges = [{ source: '1', target: '2' }];

            const result = validateWorkflow(nodes, edges);

            expect(result.valid).toBe(true);
            const fixedLLM = result.fixedNodes?.find(n => n.id === '2');
            expect(fixedLLM.data.prompt).toBe('Analyze {{My Input.text}}');
            expect(result.warnings?.some(w => /Auto-fixed Singleton Type/.test(w))).toBe(true);
        });

        it('should fix fuzzy typos in variable names', () => {
            const nodes = [
                { id: '1', type: 'input', data: { label: 'User Context' } },
                { 
                    id: '2', 
                    type: 'llm', 
                    data: { 
                        label: 'LLM',
                        prompt: 'Read {{UserContext.text}}' // Typo: Missing space
                    } 
                }
            ];
            const edges = [{ source: '1', target: '2' }];

            const result = validateWorkflow(nodes, edges);

            expect(result.valid).toBe(true);
            const fixedLLM = result.fixedNodes?.find(n => n.id === '2');
            expect(fixedLLM.data.prompt).toBe('Read {{User Context.text}}');
            expect(result.warnings?.some(w => /Auto-fixed typo/.test(w))).toBe(true);
        });
    });
});
