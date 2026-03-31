# NNB Product Architecture

## Scope

NNB is a Gemini-first ecommerce creative workstation inspired by Shopix-style AI tooling.

This repository intentionally does **not** support:

- OpenAI compatibility as a primary runtime
- Imagen as a generation backend
- Paid plans, credits, quotas, or subscription packaging in `v1`
- Long-term server-side image persistence in `v1`

This repository **does** support:

- Standard Gemini official API integration only
- Guest usage without registration
- Optional Supabase-backed accounts
- Local browser storage for generated assets and drafts
- Product-image workflows for ecommerce use cases
- A future path to video storyboards and video generation

## Product Goals

1. Recreate a polished, studio-style workflow similar to the reference product.
2. Make the main creative flows fast enough for repeated operator use.
3. Support BYOK through a settings page rather than through billing logic.
4. Keep the first release architecture compatible with later cloud storage and video expansion.

## User Modes

### Guest Mode

- No login required
- User enters Gemini API key in settings
- Assets, drafts, and history are stored in browser `IndexedDB`
- User receives repeated download reminders because generated files are not durable

### Signed-In Mode

- Supabase Auth handles identity
- Gemini API key may be stored in user settings after explicit consent
- Job metadata, presets, and preferences sync to Supabase
- Generated images still stay local in `v1`

## Core Product Modules

### 1. Main Image Studio

Purpose:

- Generate product hero images
- Create marketplace-first cover images
- Produce white-background or contextual scenes

Inputs:

- Product images
- Prompt or preset
- Target platform
- Aspect ratio
- Quality level

Outputs:

- 1 to N product images
- Prompt trace
- Platform-ready export actions

### 2. Detail Image Studio

Purpose:

- Generate feature cards, use-case images, material closeups, packaging detail imagery

Inputs:

- Product images
- Selling points
- Detail-card template selection

Outputs:

- Multi-image detail set

### 3. Style Clone Studio

Purpose:

- Use product image plus reference style images to recreate mood, composition, lighting, and texture direction

Inputs:

- Product image
- Up to multiple reference images
- Style guidance prompt

Outputs:

- Stylized variants

### 4. Retouch Studio

Purpose:

- Remove flaws
- Change background
- Adjust light/color
- Improve packaging presentation
- Refine text legibility in generated promotional assets

Inputs:

- Source image
- Edit instruction
- Aspect ratio

Outputs:

- Edited image variants

### 5. Fashion Studio

Purpose:

- Try-on
- Garment replacement
- Flat-lay presentation
- Pose variation

Inputs:

- Garment image
- Optional model image
- Optional inner layer image
- Garment category
- Pose/edit instruction

Outputs:

- Styled try-on result set

Notes:

- `v1` uses Gemini image editing for this workflow.
- Later versions may replace the internals with a dedicated VTON engine without changing the UI contract.

### 6. Commerce Studio

Purpose:

- Generate product images and platform-specific content for selling workflows
- Batch-generate titles, descriptions, tags, and CTA content
- Prepare the model for later storyboard/video expansion

Inputs:

- Product image
- Product facts
- Platform target
- Content tone
- Batch count

Outputs:

- Platform-ready creative images
- Titles
- Body copy
- Hashtags/tags
- Structured selling points

Future extension:

- Shot list
- 9-grid storyboard
- Video prompt pack
- Narration draft

### 7. History

Purpose:

- View all local jobs
- Search and filter previous runs
- Re-open prompts
- Download again while the local asset still exists

### 8. Settings

Purpose:

- Manage API key
- Configure default models
- Configure quality defaults
- Toggle local-only vs sync-enabled behavior

## Route Structure

App Router structure:

- `/`
- `/studio?module=main`
- `/studio?module=detail`
- `/studio?module=style-clone`
- `/studio?module=retouch`
- `/studio?module=fashion`
- `/studio?module=commerce`
- `/history`
- `/settings`

We use one studio shell route with module switching because:

- It matches the reference interaction style
- Shared upload/result patterns remain consistent
- Future modules can plug into the same workspace contract

## UX Structure

Each studio view uses the same 3-zone layout:

1. Top navigation and global actions
2. Left configuration rail
3. Right results workspace

Shared UX rules:

- Upload cards support drag/drop and click upload
- Results open in a full-screen lightbox
- Download CTA appears in result cards, lightbox, and history
- Active generation progress is visible at field level and job level
- Failed tasks preserve all inputs for retry

## Design Direction

Visual direction:

- Clean premium ecommerce tooling
- Warm neutral background instead of stark white
- Card-based workspace with subtle borders and soft elevation
- Gold/sand accent for active states
- Strong typography hierarchy for studio titles and section labels

Avoid:

- Generic SaaS dashboard look
- Default system-font styling
- Dark-mode-first aesthetics
- Loud rainbow gradients

## Technical Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Radix UI primitives
- TanStack Query
- Zustand for local UI workflow state
- React Hook Form + Zod for validation
- Framer Motion for focused motion only

### AI Integration

- `@google/genai`
- Standard Gemini API only
- No OpenAI compatibility runtime in `v1`

### Backend / Auth / Metadata

- Supabase Auth
- Supabase Postgres
- Supabase SSR helpers

### Local Persistence

- `Dexie` over `IndexedDB`
- Browser blob persistence for source files, results, and drafts

## Gemini Model Routing

### Default Image Models

- `gemini-3.1-flash-image-preview`
- `gemini-3-pro-image-preview`
- `gemini-2.5-flash-image` as fallback

### Default Text Models

- `gemini-3-flash-preview`
- `gemini-3.1-flash-lite-preview`
- `gemini-3.1-pro-preview` for long-form planning only

### Routing Policy

- Main / Detail / Style Clone default to `view`
- Retouch uses `view` by default and escalates to `gemini-3-pro-image-preview` for high fidelity mode
- Fashion uses `gemini-3.1-flash-image-preview` first because iterative editing speed matters
- Commerce content text uses `gemini-3-flash-preview`
- Bulk tags/titles can downgrade to `gemini-3.1-flash-lite-preview`

## Gemini Request Rules

### Official API Mode

Use the official Gemini SDK and direct API semantics.

For image generation and editing:

- Use `generateContent`
- Request image output modalities
- Use image config for aspect ratio and image size
- Support reference image inputs via inline data or Files API

### Supported Aspect Ratios

- `1:1`
- `1:4`
- `4:1`
- `1:8`
- `8:1`
- `2:3`
- `3:2`
- `3:4`
- `4:3`
- `4:5`
- `5:4`
- `9:16`
- `16:9`
- `21:9`

### Supported Image Sizes

- `512`
- `1K`
- `2K`
- `4K`

### Asset Input Strategy

- Use inline bytes for smaller inputs
- Use Gemini Files API when request size or re-use patterns justify it
- Normalize image MIME handling before request dispatch

## Job Pipeline

### Request Flow

1. User selects module
2. User uploads assets
3. Inputs are validated by schema
4. Assets are normalized client-side when possible
5. Draft is saved to local store
6. Request is sent to server action or API route
7. Server reads active Gemini settings
8. Server calls Gemini
9. Response is normalized into app job result format
10. Output image blobs are written into local browser storage
11. Job metadata is optionally synced to Supabase

### Job Status Model

- `draft`
- `queued`
- `running`
- `completed`
- `failed`
- `partial`

## Concurrency Rules

Commerce content batch generation must respect a max concurrency of `5`.

Implementation rule:

- Use `p-limit(5)` for content batch jobs
- Keep image generation sequential by default in `v1` unless provider testing proves parallel image requests are stable for the user key

## Local Storage Model

### IndexedDB Tables

- `jobs`
- `assets`
- `drafts`
- `settings`

### Local Job Shape

- Job metadata
- Module type
- Prompt payload
- Referenced asset ids
- Output asset ids
- Download status
- Created and updated timestamps

## Supabase Data Model

### `profiles`

- `id`
- `email`
- `display_name`
- `avatar_url`
- `created_at`
- `updated_at`

### `provider_profiles`

- `id`
- `user_id`
- `provider_type`
- `api_key_ciphertext`
- `default_image_model`
- `default_text_model`
- `default_aspect_ratio`
- `default_image_size`
- `created_at`
- `updated_at`

### `prompt_presets`

- `id`
- `user_id`
- `module`
- `name`
- `body`
- `platform`
- `is_system`
- `created_at`
- `updated_at`

### `studio_jobs`

- `id`
- `user_id`
- `module`
- `status`
- `input_summary`
- `output_summary`
- `local_cache_key`
- `result_count`
- `created_at`
- `updated_at`

### `job_events`

- `id`
- `job_id`
- `event_type`
- `payload`
- `created_at`

## Security Rules

- Enable RLS on all public schema tables
- Users can only access rows where `auth.uid()` matches ownership
- API keys are never exposed in URL parameters
- Server-side routes must avoid logging secrets
- Browser-only mode stores key locally only after explicit user action

## Result Persistence Policy

`v1` policy:

- Generated images are local-only
- Every result surface must show download reminders
- History entries stay visible even when underlying blobs are missing
- Missing local blobs should degrade gracefully with a “re-generate or re-upload” path

Future policy:

- Optional Supabase Storage or Cloudflare R2 persistence
- Signed URLs for remote image retrieval

## Component Architecture

### Shared Workspace Components

- `AppShell`
- `TopNav`
- `StudioShell`
- `StudioSidebar`
- `ResultCanvas`
- `ResultGrid`
- `ImageLightbox`
- `UploadCard`
- `PromptTextarea`
- `PresetGrid`
- `BatchPanel`

### Studio Module Components

- `MainStudioPanel`
- `DetailStudioPanel`
- `StyleClonePanel`
- `RetouchPanel`
- `FashionPanel`
- `CommercePanel`

### Infrastructure Components

- `Providers`
- `QueryProvider`
- `ToastProvider`
- `AuthBoundary`

## Validation Architecture

- Every module owns a dedicated Zod schema
- Shared primitives validate uploaded assets, platform targets, aspect ratio, and output count
- Server routes re-validate everything even if client validation already passed

## Testing Strategy

### Unit

- Schema validation
- Prompt builders
- Result normalizers
- Local storage adapters

### Integration

- Gemini request adapter
- Supabase sync adapter

### E2E

- Main image generation flow
- Fashion try-on submission flow
- Commerce batch generation flow
- History restore and download flow

## Delivery Phases

### Phase 1

- Architecture docs
- Project structure
- Visual system
- Navigation
- Settings
- Provider config

### Phase 2

- Main image studio
- Retouch studio
- Style clone studio

### Phase 3

- Detail image studio
- History
- Local persistence

### Phase 4

- Fashion studio

### Phase 5

- Commerce studio
- Batch titles/copy/tags with concurrency limit `5`

### Phase 6

- Supabase auth and metadata sync

### Phase 7

- Cloud persistence
- Video prep workflow

## Non-Negotiable Product Rules

- No paid feature UI in `v1`
- No package/pricing menu in the nav
- Commerce module must exist in top navigation
- Fashion module must expose try-on, garment swap, flat-lay, and pose workflows
- Images must support click-to-zoom everywhere
- The product must repeatedly remind users to download results
