# Database ERD

Generated from `prisma/schema.prisma`. Renders natively on GitHub.

> Note: `LedgerAccount.tenantId` is a plain column with no Prisma relation to
> `Tenant` (system rows use `tenantId = null`), so it is not drawn as an edge.

```mermaid
erDiagram
  Tenant ||--o{ Page : has
  Tenant ||--o{ Post : has
  Tenant ||--o{ Template : has
  Tenant ||--o{ ChromeAssignment : has

  Page ||--o{ Page : "parent/children (PageTree)"

  Post }o--o{ Category : "PostCategories"
  Post }o--o{ Tag : "PostTags"

  DocChunk ||--o{ DocChunkUrl : has

  LedgerTransaction ||--o{ LedgerEntry : has
  LedgerAccount ||--o{ LedgerEntry : has
  LedgerAccount ||--o| AccountBalance : has

  Tenant {
    string id PK
    string name
    string slug UK
    string domain UK "nullable"
    json   theme
    int    themeVersion
    datetime createdAt
    datetime updatedAt
  }

  ChromeAssignment {
    string id PK
    string tenantId FK
    string segment "TEMPLATE_HIERARCHY slug"
    string headerSlug "nullable"
    string footerSlug "nullable"
    datetime createdAt
    datetime updatedAt
  }

  Page {
    string id PK
    string slug
    string path
    string parentId FK "nullable"
    string tenantId FK
    string title
    json   data
    json   draftData "nullable autosave"
    enum   status "DRAFT|PUBLISHED"
    datetime publishedAt "nullable"
    datetime createdAt
    datetime updatedAt
  }

  Post {
    string id PK
    string slug
    string tenantId FK
    string title
    string excerpt "nullable"
    string featuredImage "nullable"
    json   data
    json   draftData "nullable autosave"
    enum   status "DRAFT|PUBLISHED"
    datetime publishedAt "nullable"
    datetime createdAt
    datetime updatedAt
  }

  Category {
    string id PK
    string slug UK
    string name
  }

  Tag {
    string id PK
    string slug UK
    string name
  }

  Template {
    string id PK
    string tenantId FK "nullable = global"
    string slug
    enum   kind "LAYOUT|PATTERN|PART"
    string area "nullable; req when PART"
    bool   synced
    string title
    string description "nullable"
    json   data
    json   draftData "nullable autosave"
    string preview "nullable"
    datetime createdAt
    datetime updatedAt
  }

  Redirect {
    string id PK
    string fromPath UK
    string toPath
    datetime createdAt
  }

  DocChunk {
    string id PK
    string contentHash UK
    string content
    string headerPath
    string kind
    int    tokenCount
    vector embedding "vector(3072)"
    datetime createdAt
  }

  DocChunkUrl {
    string id PK
    string chunkHash FK
    string url
    string title
    datetime lastSeenAt
  }

  LedgerAccount {
    string id PK
    string tenantId "nullable = system; no FK"
    string accountCode
    enum   accountType "SYSTEM|TENANT"
    datetime createdAt
  }

  LedgerTransaction {
    string id PK
    string tenantId "nullable"
    string transactionType
    string referenceType "nullable"
    string referenceId "nullable"
    string description "nullable"
    string idempotencyKey UK
    datetime createdAt
  }

  LedgerEntry {
    string id PK
    string transactionId FK
    string accountId FK
    bigint amount "signed units"
    datetime createdAt
  }

  AccountBalance {
    string accountId PK,FK
    bigint balance
    datetime updatedAt
  }
```
