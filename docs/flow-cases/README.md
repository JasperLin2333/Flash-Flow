# Flow Case JSON Format

Store each case as a single JSON file in this folder.

Minimal example:

{
  "title": "客服退款处理",
  "goal": "用户提交退款申请并自动判断是否需要人工介入",
  "tags": ["客服", "退款", "订单"],
  "workflow": {
    "title": "客服退款处理",
    "nodes": [...],
    "edges": [...]
  }
}

Notes:
- `workflow.nodes` and `workflow.edges` are required.
- Full JSON will be injected as few-shot when matched.

## Export From Database

Export sampled flows from Supabase `flows` table into this folder:

```
npm run export:flow-cases -- --limit=5 --sample=recent
```

Options:
- `--limit=5` (default 5)
- `--sample=recent|random` (default recent)
- `--owner=<user_id>` (optional)
- `--min-nodes=2` (default 2)
- `--overwrite` (overwrite existing files)
- `--dir=docs/flow-cases` (custom output dir)
- `--dry-run`

After exporting, run:

```
npm run seed:flow-cases -- --truncate
```

## Auto-Generate High-Quality Cases

Generate 30 curated consumer/office/learning/fun cases with quality checks:

```
npm run gen:flow-cases -- --count=30
```

Files are written to `docs/flow-cases/auto` by default. Then seed:

```
npm run seed:flow-cases -- --truncate --dir=docs/flow-cases/auto
```

Or do both in one command:

```
npm run gen:flow-cases -- --count=30 --seed
```
