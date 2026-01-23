/**
 * 修改工作流专用 Prompt (Full Mode)
 */
export const MODIFY_PROMPT = `
<modification_guidelines>
1. **Analyze Requirements**: Carefully interpret how the user wants to change the existing workflow.
2. **Preserve Integrity**: Do not remove existing nodes/edges unless explicitly requested or necessary.
3. **Smart Updates**:
   - When adding nodes, ensure they are properly connected (edges).
   - When removing nodes, clean up orphan edges.
   - When updating config, keep other fields intact.
</modification_guidelines>
`;
