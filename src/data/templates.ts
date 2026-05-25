export interface Template {
  id: string;
  label: string;
  description: string;
  fileType: 'md' | 'excalidraw' | 'mermaid';
  content: string;
  icon: string;
  suggestedName: string;
}

export const templates: Template[] = [
  // Markdown templates
  {
    id: 'md-blank',
    label: 'Blank Document',
    description: 'Empty markdown file',
    fileType: 'md',
    content: '# Untitled\n\n',
    icon: 'doc',
    suggestedName: 'untitled',
  },
  {
    id: 'md-architecture',
    label: 'Architecture Doc',
    description: 'System architecture template with components, data flow, and decisions',
    fileType: 'md',
    content: `# Architecture: [System Name]\n\n## Overview\n\nBrief description of the system.\n\n## Goals & Constraints\n\n- Goal 1\n- Constraint 1\n\n## Components\n\n### Component A\n\nDescription and responsibilities.\n\n### Component B\n\nDescription and responsibilities.\n\n## Data Flow\n\nDescribe how data moves through the system.\n\n## Decisions\n\n| Decision | Rationale | Date |\n|----------|-----------|------|\n| | | |\n\n## Open Questions\n\n- [ ] Question 1\n`,
    icon: 'arch',
    suggestedName: 'architecture-',
  },
  {
    id: 'md-adr',
    label: 'Decision Record (ADR)',
    description: 'Document an architecture decision with context and consequences',
    fileType: 'md',
    content: `# ADR-000: [Title]\n\n## Status\n\nProposed\n\n## Context\n\nDescribe the context and problem.\n\n## Decision\n\nDescribe the decision made.\n\n## Consequences\n\n### Positive\n\n- \n\n### Negative\n\n- \n\n### Neutral\n\n- \n`,
    icon: 'decision',
    suggestedName: 'adr-',
  },
  {
    id: 'md-meeting',
    label: 'Meeting Notes',
    description: 'Agenda, notes, and action items from a meeting',
    fileType: 'md',
    content: `# Meeting: [Topic]\n\n**Date:** YYYY-MM-DD  \n**Attendees:** \n\n## Agenda\n\n1. \n\n## Notes\n\n\n\n## Action Items\n\n- [ ] \n`,
    icon: 'meeting',
    suggestedName: 'meeting-',
  },
  {
    id: 'md-feature-spec',
    label: 'Feature Spec',
    description: 'Full feature specification with user stories, requirements, and timeline',
    fileType: 'md',
    content: `---\ntags: [feature, draft]\nstatus: draft\n---\n\n# Feature: [Name]\n\n## Summary\n\nOne-paragraph description of what this feature does.\n\n## Motivation\n\nWhy are we building this? What problem does it solve?\n\n## User Stories\n\n- As a [user], I want [goal] so that [reason]\n\n## Requirements\n\n### Must Have\n\n- [ ] \n\n### Nice to Have\n\n- [ ] \n\n## Technical Approach\n\nHigh-level implementation plan.\n\n## API Changes\n\n| Endpoint | Method | Description |\n|----------|--------|-------------|\n| | | |\n\n## UI/UX\n\nDescribe the user interface changes.\n\n## Risks & Open Questions\n\n- [ ] \n\n## Timeline\n\n| Milestone | Target Date |\n|-----------|------------|\n| | |\n`,
    icon: 'feature',
    suggestedName: 'feature-',
  },
  {
    id: 'md-api-spec',
    label: 'API Spec',
    description: 'REST API documentation with endpoints, params, and responses',
    fileType: 'md',
    content: `---\ntags: [api, draft]\nstatus: draft\n---\n\n# API: [Service Name]\n\n## Base URL\n\n\`https://api.example.com/v1\`\n\n## Authentication\n\nBearer token in \`Authorization\` header.\n\n## Endpoints\n\n### GET /resource\n\n**Description:** List all resources.\n\n**Query Parameters:**\n\n| Param | Type | Required | Description |\n|-------|------|----------|-------------|\n| page | int | no | Page number |\n| limit | int | no | Items per page |\n\n**Response 200:**\n\n\`\`\`json\n{\n  "data": [],\n  "pagination": {\n    "page": 1,\n    "total": 0\n  }\n}\n\`\`\`\n\n### POST /resource\n\n**Description:** Create a new resource.\n\n**Request Body:**\n\n\`\`\`json\n{\n  "name": "string",\n  "description": "string"\n}\n\`\`\`\n\n**Response 201:**\n\n\`\`\`json\n{\n  "id": "string",\n  "name": "string",\n  "created_at": "string"\n}\n\`\`\`\n\n## Error Codes\n\n| Code | Description |\n|------|-------------|\n| 400 | Bad request |\n| 401 | Unauthorized |\n| 404 | Not found |\n| 500 | Internal error |\n`,
    icon: 'api',
    suggestedName: 'api-',
  },
  {
    id: 'md-runbook',
    label: 'Runbook',
    description: 'Operational playbook with steps, rollback, and post-incident',
    fileType: 'md',
    content: `---\ntags: [ops, runbook]\nstatus: approved\n---\n\n# Runbook: [Incident Type]\n\n## Trigger\n\nWhen does this runbook apply?\n\n## Impact\n\n**Severity:** High / Medium / Low  \n**Affected Systems:** \n\n## Steps\n\n1. **Verify** — Confirm the issue\n2. **Mitigate** — Immediate actions\n3. **Resolve** — Root cause fix\n4. **Communicate** — Notify stakeholders\n\n## Rollback\n\nSteps to undo changes if resolution fails.\n\n## Post-Incident\n\n- [ ] Write post-mortem\n- [ ] Update monitoring\n- [ ] Review this runbook\n`,
    icon: 'ops',
    suggestedName: 'runbook-',
  },
  // Mermaid templates
  {
    id: 'mermaid-flowchart',
    label: 'Flowchart',
    description: 'Top-down process flow with decisions and actions',
    fileType: 'mermaid',
    content: `graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action 1]\n    B -->|No| D[Action 2]\n    C --> E[End]\n    D --> E\n`,
    icon: 'flow',
    suggestedName: 'flowchart-',
  },
  {
    id: 'mermaid-sequence',
    label: 'Sequence Diagram',
    description: 'Request/response interaction between services',
    fileType: 'mermaid',
    content: `sequenceDiagram\n    participant Client\n    participant Server\n    participant Database\n\n    Client->>Server: Request\n    Server->>Database: Query\n    Database-->>Server: Result\n    Server-->>Client: Response\n`,
    icon: 'sequence',
    suggestedName: 'sequence-',
  },
  {
    id: 'mermaid-class',
    label: 'Class Diagram',
    description: 'Object-oriented class structure with inheritance',
    fileType: 'mermaid',
    content: `classDiagram\n    class Animal {\n        +String name\n        +int age\n        +makeSound()\n    }\n    class Dog {\n        +fetch()\n    }\n    class Cat {\n        +purr()\n    }\n    Animal <|-- Dog\n    Animal <|-- Cat\n`,
    icon: 'class',
    suggestedName: 'class-diagram-',
  },
  {
    id: 'mermaid-er',
    label: 'ER Diagram',
    description: 'Entity-relationship database schema',
    fileType: 'mermaid',
    content: `erDiagram\n    USER ||--o{ POST : creates\n    USER {\n        int id PK\n        string name\n        string email\n    }\n    POST {\n        int id PK\n        string title\n        string content\n        int author_id FK\n    }\n`,
    icon: 'database',
    suggestedName: 'er-diagram-',
  },
  {
    id: 'mermaid-state',
    label: 'State Diagram',
    description: 'State machine with transitions and conditions',
    fileType: 'mermaid',
    content: `stateDiagram-v2\n    [*] --> Idle\n    Idle --> Processing : submit\n    Processing --> Success : done\n    Processing --> Error : fail\n    Error --> Idle : retry\n    Success --> [*]\n`,
    icon: 'state',
    suggestedName: 'state-diagram-',
  },
  // Excalidraw
  {
    id: 'excalidraw-blank',
    label: 'Blank Canvas',
    description: 'Freeform drawing canvas for diagrams and sketches',
    fileType: 'excalidraw',
    content: '',
    icon: 'canvas',
    suggestedName: 'drawing-',
  },
];
